import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { fingerprint } from "@/lib/jobs/analysis";
import { loadCareerFacts } from "@/lib/resumes/career";
import { buildResumePlan } from "@/lib/resumes/plan";
import { loadApprovedMasterResume } from "@/lib/resumes/master";
import { getResumeGenerationProvider } from "@/lib/resumes/provider";
import { buildResumeDiff, buildResumeStrategy } from "@/lib/resumes/review";
import { collectResumeEvidence, loadResumeView } from "@/lib/resumes/store";
import { validateResumeContent } from "@/lib/resumes/validation";
import { resumeContentSchema, type ResumeContent, type ResumeGenerationKind } from "@/lib/resumes/types";

type GenerateOptions = { kind?: ResumeGenerationKind; proposedContent?: ResumeContent; scope?: { type: "ENTIRE" | "SUMMARY" | "BULLET"; contentKey?: string }; projectId?: string | null };

export function resumeRequestFingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function generateResumeVersion(database: SupabaseClient, ownerId: string, jobId: string, options: GenerateOptions = {}) {
  const { data: job, error: jobError } = await database.from("job_opportunities").select("id, title, company_name, description_text, status").eq("id", jobId).eq("owner_id", ownerId).maybeSingle();
  if (jobError || !job || job.status !== "SAVED") throw new Error("SAVED_JOB_NOT_FOUND");
  const { data: analysis, error: analysisError } = await database.from("job_analyses").select("id, analysis_version, status, description_fingerprint, result_summary").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).eq("status", "COMPLETE").order("analysis_version", { ascending: false }).limit(1).maybeSingle();
  if (analysisError || !analysis) throw new Error("CURRENT_CAREER_MATCH_REQUIRED");
  if (analysis.description_fingerprint !== fingerprint(job.description_text ?? "")) throw new Error("CURRENT_CAREER_MATCH_REQUIRED");
  const master = await loadApprovedMasterResume(database, ownerId);
  if (!master) throw new Error("MASTER_RESUME_APPROVAL_REQUIRED");
  const career = await loadCareerFacts(database, ownerId);
  const current = await loadResumeView(database, ownerId, jobId);
  let resumeId = current?.id;
  if (!resumeId) {
    const { data: created, error } = await database.from("tailored_resumes").insert({ owner_id: ownerId, job_opportunity_id: jobId }).select("id").single();
    if (error || !created) throw new Error("RESUME_CREATE_FAILED");
    resumeId = created.id;
  }
  const versionNumber = Math.max(0, ...(current?.versions.map((item) => item.versionNumber) ?? [])) + 1;
  const provider = getResumeGenerationProvider();
  const plan = await buildResumePlan(database, ownerId, jobId, { id: analysis.id, version: analysis.analysis_version }, career);
  const kind = options.kind ?? (current?.currentVersionId ? "REGENERATED" : "INITIAL");
  const parent = current?.versions.find((item) => item.id === current.currentVersionId) ?? null;
  let projectId = options.projectId ?? parent?.projectId ?? null;
  if (projectId) {
    const { data: association } = await database.from("job_opportunity_projects").select("project_id").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).eq("project_id", projectId).maybeSingle();
    if (!association) throw new Error("JOB_PROJECT_ASSOCIATION_REQUIRED");
  } else {
    const { data: association } = await database.from("job_opportunity_projects").select("project_id").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).order("associated_at").limit(1).maybeSingle();
    projectId = association?.project_id ?? null;
  }
  const requestHash = resumeRequestFingerprint({ kind, scope: options.scope ?? null, proposedContent: options.proposedContent ?? null, analysisId: analysis.id, analysisVersion: analysis.analysis_version, careerFingerprint: career.fingerprint, masterVersionId: master.id, projectId });
  const { data: existing } = await database.from("tailored_resume_versions").select("id, version_number, content").eq("owner_id", ownerId).eq("resume_id", resumeId).eq("request_fingerprint", requestHash).in("status", ["REVIEW", "APPROVED", "STALE"]).maybeSingle();
  if (existing) return { resumeId, versionId: existing.id, versionNumber: existing.version_number, content: resumeContentSchema.parse(existing.content), reused: true };
  const { data: pending, error: pendingError } = await database.from("tailored_resume_versions").insert({ owner_id: ownerId, resume_id: resumeId, job_analysis_id: analysis.id, parent_version_id: parent?.id ?? null, project_id: projectId, master_resume_version_id: master.id, version_number: versionNumber, generation_kind: kind, status: "GENERATING", provider_key: provider.key, provider_mode: provider.mode, plan, analysis_version: analysis.analysis_version, description_fingerprint: fingerprint(job.description_text ?? ""), career_fingerprint: career.fingerprint, request_fingerprint: requestHash }).select("id").single();
  if (pendingError || !pending) throw new Error("RESUME_VERSION_CREATE_FAILED");
  try {
    const unsupportedTermsResult = await database.from("job_analysis_requirements").select("normalized_concept").eq("owner_id", ownerId).eq("analysis_id", analysis.id).eq("match_state", "NO_MATCH");
    const unsupportedTerms = (unsupportedTermsResult.data ?? []).map((item) => item.normalized_concept).filter((item): item is string => Boolean(item));
    const content = options.proposedContent ?? await provider.generate({ plan, career, job: { id: job.id, title: job.title, employer: job.company_name, description: job.description_text ?? "" }, priorContent: parent?.content ?? undefined, scope: options.scope });
    const validated = validateResumeContent(content, career, { title: job.title, employer: job.company_name }, unsupportedTerms);
    const strategy = buildResumeStrategy(analysis.result_summary ?? {}, master.content, validated.content);
    const diff = buildResumeDiff(master.content, validated.content);
    const { error: completionError } = await database.from("tailored_resume_versions").update({ status: "REVIEW", content: validated.content, strategy, resume_diff: diff, review_decisions: {}, validation_summary: validated.summary, generated_at: new Date().toISOString(), failure_code: null, failure_message: null }).eq("id", pending.id).eq("owner_id", ownerId);
    if (completionError) throw new Error("RESUME_VERSION_COMPLETE_FAILED");
    const evidence = collectResumeEvidence(validated.content, career.factsByKey).map((item) => ({ owner_id: ownerId, resume_version_id: pending.id, content_key: item.contentKey, evidence_type: item.type, evidence_id: item.id, evidence_label: item.label.slice(0, 300) }));
    if (evidence.length) {
      const { error: evidenceError } = await database.from("tailored_resume_evidence").insert(evidence);
      if (evidenceError) throw new Error("RESUME_EVIDENCE_PERSIST_FAILED");
    }
    const { error: activateError } = await database.from("tailored_resumes").update({ current_version_id: pending.id }).eq("id", resumeId).eq("owner_id", ownerId);
    if (activateError) throw new Error("RESUME_ACTIVATION_FAILED");
    return { resumeId, versionId: pending.id, versionNumber, content: validated.content, reused: false };
  } catch (error) {
    await database.from("tailored_resume_versions").update({ status: "FAILED", failure_code: error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "RESUME_GENERATION_FAILED", failure_message: error instanceof Error ? error.message.slice(0, 500) : "Resume generation failed. The last successful version remains unchanged." }).eq("id", pending.id).eq("owner_id", ownerId);
    throw error;
  }
}
