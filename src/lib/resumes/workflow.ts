import type { SupabaseClient } from "@supabase/supabase-js";
import { fingerprint } from "@/lib/jobs/analysis";
import { loadCareerFacts } from "@/lib/resumes/career";
import { masterResumeContentSchema, resumeContentSchema, resumeDecisionSchema, resumeDiffItemSchema, type MasterResumeContent, type ResumeContent, type ResumeDecision } from "@/lib/resumes/types";
import { validateResumeContent } from "@/lib/resumes/validation";

function replaceBlock(content: ResumeContent, key: string, text: string | null) {
  const update = (blocks: ResumeContent["experiences"][number]["bullets"]) => blocks.flatMap((block) => block.key !== key ? [block] : text ? [{ ...block, text }] : []);
  return { ...content, summary: content.summary.key === key && text ? { ...content.summary, text } : content.summary, experiences: content.experiences.map((entry) => ({ ...entry, bullets: update(entry.bullets) })), projects: content.projects.map((entry) => ({ ...entry, bullets: update(entry.bullets) })) };
}

function applyRejectedChange(content: ResumeContent, master: MasterResumeContent, item: ReturnType<typeof resumeDiffItemSchema.parse>) {
  if (item.contentKey === "experience:order") {
    const byId = new Map(content.experiences.map((entry) => [entry.experienceId, entry]));
    return { ...content, experiences: master.experiences.flatMap((entry) => byId.get(entry.experienceId) ?? []) };
  }
  if (item.contentKey === "skills:selection") return { ...content, skillGroups: master.skillGroups };
  if (item.contentKey?.startsWith("project:") && item.contentKey.split(":").length === 2) {
    const projectId = item.contentKey.split(":")[1];
    const source = master.projects.find((project) => project.projectId === projectId);
    return { ...content, projects: source ? [...content.projects.filter((project) => project.projectId !== projectId), source] : content.projects.filter((project) => project.projectId !== projectId) };
  }
  if (item.contentKey && item.before !== null) {
    const sourceBlock = [...master.experiences.flatMap((entry) => entry.bullets), ...master.projects.flatMap((entry) => entry.bullets)].find((block) => block.key === item.contentKey);
    const hasBlock = [...content.experiences.flatMap((entry) => entry.bullets), ...content.projects.flatMap((entry) => entry.bullets)].some((block) => block.key === item.contentKey);
    if (!hasBlock && sourceBlock) {
      const experience = master.experiences.find((entry) => entry.bullets.some((block) => block.key === item.contentKey));
      if (experience) return { ...content, experiences: content.experiences.map((entry) => entry.experienceId === experience.experienceId ? { ...entry, bullets: [...entry.bullets, sourceBlock] } : entry) };
    }
    return replaceBlock(content, item.contentKey, item.before);
  }
  if (item.contentKey) return replaceBlock(content, item.contentKey, null);
  return content;
}

export async function decideResumeChange(database: SupabaseClient, ownerId: string, resumeId: string, versionId: string, changeKey: string, input: { decision: ResumeDecision["decision"]; editedText?: string }) {
  const { data: version, error } = await database.from("tailored_resume_versions").select("id, resume_id, status, content, resume_diff, review_decisions, master_resume_version_id").eq("id", versionId).eq("resume_id", resumeId).eq("owner_id", ownerId).maybeSingle();
  if (error || !version) throw new Error("RESUME_VERSION_NOT_FOUND");
  if (version.status !== "REVIEW") throw new Error("RESUME_VERSION_NOT_REVIEWABLE");
  const item = (version.resume_diff ?? []).map((candidate: unknown) => resumeDiffItemSchema.parse(candidate)).find((candidate: ReturnType<typeof resumeDiffItemSchema.parse>) => candidate.key === changeKey);
  if (!item) throw new Error("RESUME_CHANGE_NOT_FOUND");
  const { data: masterVersion } = await database.from("master_resume_versions").select("content").eq("id", version.master_resume_version_id).eq("owner_id", ownerId).maybeSingle();
  if (!masterVersion) throw new Error("MASTER_RESUME_VERSION_NOT_FOUND");
  let content = resumeContentSchema.parse(version.content);
  if (input.decision === "EDITED") {
    if (!item.contentKey || !input.editedText) throw new Error("RESUME_CHANGE_EDIT_INVALID");
    content = replaceBlock(content, item.contentKey, input.editedText);
  } else if (input.decision === "REJECTED") content = applyRejectedChange(content, masterResumeContentSchema.parse(masterVersion.content), item);
  const { data: resume } = await database.from("tailored_resumes").select("job_opportunity_id").eq("id", resumeId).eq("owner_id", ownerId).maybeSingle();
  const { data: job } = resume ? await database.from("job_opportunities").select("title, company_name").eq("id", resume.job_opportunity_id).eq("owner_id", ownerId).maybeSingle() : { data: null };
  if (!job) throw new Error("SAVED_JOB_NOT_FOUND");
  const career = await loadCareerFacts(database, ownerId);
  const validated = validateResumeContent(content, career, { title: job.title, employer: job.company_name });
  const decisions = { ...(version.review_decisions ?? {}), [changeKey]: resumeDecisionSchema.parse({ decision: input.decision, ...(input.editedText ? { editedText: input.editedText } : {}), decidedAt: new Date().toISOString() }) };
  const { error: updateError } = await database.from("tailored_resume_versions").update({ content: validated.content, validation_summary: validated.summary, review_decisions: decisions }).eq("id", versionId).eq("owner_id", ownerId).eq("status", "REVIEW");
  if (updateError) throw new Error("RESUME_CHANGE_DECISION_FAILED");
  return { content: validated.content, decisions };
}

export async function approveResumeVersion(database: SupabaseClient, ownerId: string, resumeId: string, versionId: string) {
  const { data: version, error } = await database.from("tailored_resume_versions").select("id, status, content, resume_diff, review_decisions, career_fingerprint, description_fingerprint, job_analysis_id").eq("id", versionId).eq("resume_id", resumeId).eq("owner_id", ownerId).maybeSingle();
  if (error || !version) throw new Error("RESUME_VERSION_NOT_FOUND");
  if (version.status !== "REVIEW") throw new Error("RESUME_VERSION_NOT_REVIEWABLE");
  const { data: resume } = await database.from("tailored_resumes").select("job_opportunity_id").eq("id", resumeId).eq("owner_id", ownerId).maybeSingle();
  const { data: job } = resume ? await database.from("job_opportunities").select("title, company_name, description_text").eq("id", resume.job_opportunity_id).eq("owner_id", ownerId).maybeSingle() : { data: null };
  const { data: analysis } = await database.from("job_analyses").select("id, status").eq("id", version.job_analysis_id).eq("owner_id", ownerId).maybeSingle();
  if (!job || analysis?.status !== "COMPLETE" || fingerprint(job.description_text ?? "") !== version.description_fingerprint) throw new Error("CURRENT_CAREER_MATCH_REQUIRED");
  const career = await loadCareerFacts(database, ownerId);
  if (career.fingerprint !== version.career_fingerprint) throw new Error("RESUME_REFRESH_REQUIRED");
  const validated = validateResumeContent(version.content, career, { title: job.title, employer: job.company_name });
  const decidedAt = new Date().toISOString();
  const decisions = { ...(version.review_decisions ?? {}) } as Record<string, ResumeDecision>;
  for (const candidate of version.resume_diff ?? []) {
    const change = resumeDiffItemSchema.parse(candidate);
    if (!decisions[change.key]) decisions[change.key] = { decision: "APPROVED", decidedAt };
  }
  const { error: approveError } = await database.from("tailored_resume_versions").update({ status: "APPROVED", content: validated.content, validation_summary: validated.summary, review_decisions: decisions, approved_at: decidedAt, snapshot_locked_at: decidedAt }).eq("id", versionId).eq("owner_id", ownerId).eq("status", "REVIEW");
  if (approveError) throw new Error("RESUME_APPROVAL_FAILED");
  const { error: currentError } = await database.from("tailored_resumes").update({ current_version_id: versionId }).eq("id", resumeId).eq("owner_id", ownerId);
  if (currentError) throw new Error("RESUME_APPROVAL_FAILED");
  return { approvedAt: decidedAt, decisions };
}
