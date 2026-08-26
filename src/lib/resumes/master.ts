import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCareerFacts, type CareerFacts } from "@/lib/resumes/career";
import { collectResumeEvidence } from "@/lib/resumes/store";
import { masterResumeContentSchema, type MasterResumeContent, type MasterResumeView, type ResumeContent } from "@/lib/resumes/types";
import { validateResumeContent } from "@/lib/resumes/validation";

function buildMasterContent(career: CareerFacts): MasterResumeContent {
  const organizations = new Map(career.organizations.map((item) => [item.id, item.name]));
  const titles = new Map(career.titles.map((item) => [item.id, item.name]));
  const metricsByAccomplishment = new Map<string, typeof career.metrics>();
  for (const metric of career.metrics) metricsByAccomplishment.set(metric.accomplishmentId, [...(metricsByAccomplishment.get(metric.accomplishmentId) ?? []), metric]);
  const experiences = career.experiences.filter((item) => item.completeness === "COMPLETE" && item.titleId).slice(0, 10).map((experience) => {
    const accomplishments = career.accomplishments.filter((item) => item.experienceId === experience.id && !item.projectId).slice(0, 5);
    const bullets: MasterResumeContent["experiences"][number]["bullets"] = accomplishments.map((item, index) => ({
      key: `experience:${experience.id}:bullet:${index + 1}`,
      text: item.statement,
      evidence: [
        { type: "ACCOMPLISHMENT" as const, id: item.id },
        ...(metricsByAccomplishment.get(item.id) ?? []).map((metric) => ({ type: "METRIC" as const, id: metric.id }))
      ]
    }));
    if (!bullets.length && experience.summary) bullets.push({ key: `experience:${experience.id}:bullet:1`, text: experience.summary, evidence: [{ type: "EXPERIENCE" as const, id: experience.id }] });
    return {
      experienceId: experience.id,
      employer: organizations.get(experience.organizationId) ?? "Unknown employer",
      client: experience.clientOrganizationId ? organizations.get(experience.clientOrganizationId) ?? null : null,
      title: experience.titleId ? titles.get(experience.titleId) ?? null : null,
      startDate: experience.startDate,
      startPrecision: experience.startPrecision,
      endDate: experience.endDate,
      endPrecision: experience.endPrecision,
      isCurrent: experience.isCurrent,
      location: experience.location,
      bullets
    };
  });
  const projects = career.projects.slice(0, 6).map((project) => ({
    projectId: project.id,
    name: project.name,
    bullets: [project.summary, project.impact].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index).slice(0, 2).map((text, index) => ({ key: `project:${project.id}:bullet:${index + 1}`, text, evidence: [{ type: "PROJECT" as const, id: project.id }] }))
  })).filter((project) => project.bullets.length);
  const categories = [...new Set(career.skills.map((skill) => skill.category))];
  return masterResumeContentSchema.parse({
    candidate: { fullName: career.profile.fullName, headline: career.profile.headline, location: career.profile.location },
    summary: { key: "summary:professional", text: career.profile.summary, evidence: [{ type: "PROFILE", id: career.profile.ownerId }] },
    experiences,
    projects,
    skillGroups: categories.map((category) => ({ category, skills: career.skills.filter((skill) => skill.category === category).map((skill) => ({ skillId: skill.id, name: skill.name })) })),
    education: career.education.map((item) => ({ educationId: item.id, degree: item.degree, fieldOfStudy: item.fieldOfStudy, institution: item.institution, completedOn: item.completedOn })),
    credentials: career.credentials.map((item) => ({ credentialId: item.id, name: item.name, status: item.status }))
  });
}

function validateMaster(contentInput: unknown, career: CareerFacts) {
  const content = masterResumeContentSchema.parse(contentInput);
  const validation = validateResumeContent({ ...content, target: { jobTitle: "General Executive Resume", employer: "Owner-approved Master Resume" } }, career, { title: "General Executive Resume", employer: "Owner-approved Master Resume" });
  const validated = validation.content;
  return { content: masterResumeContentSchema.parse({ candidate: validated.candidate, summary: validated.summary, experiences: validated.experiences, projects: validated.projects, skillGroups: validated.skillGroups, education: validated.education, credentials: validated.credentials }), summary: validation.summary };
}

export async function loadMasterResumeView(database: SupabaseClient, ownerId: string): Promise<MasterResumeView | null> {
  const { data: resume, error } = await database.from("master_resumes").select("id, current_version_id").eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Error("MASTER_RESUME_UNAVAILABLE");
  if (!resume) return null;
  const { data: versions, error: versionError } = await database.from("master_resume_versions").select("id, version_number, status, content, career_fingerprint, approved_at, stale_at, created_at").eq("owner_id", ownerId).eq("master_resume_id", resume.id).order("version_number", { ascending: false });
  if (versionError) throw new Error("MASTER_RESUME_UNAVAILABLE");
  return {
    id: resume.id,
    currentVersionId: resume.current_version_id,
    versions: (versions ?? []).map((row) => ({ id: row.id, versionNumber: row.version_number, status: row.status, content: masterResumeContentSchema.parse(row.content), careerFingerprint: row.career_fingerprint, approvedAt: row.approved_at, staleAt: row.stale_at, createdAt: row.created_at }))
  };
}

export async function createMasterResumeVersion(database: SupabaseClient, ownerId: string, proposedContent?: MasterResumeContent) {
  const career = await loadCareerFacts(database, ownerId);
  let resume = await loadMasterResumeView(database, ownerId);
  if (!resume) {
    const { data, error } = await database.from("master_resumes").insert({ owner_id: ownerId }).select("id").single();
    if (error || !data) throw new Error("MASTER_RESUME_CREATE_FAILED");
    resume = { id: data.id, currentVersionId: null, versions: [] };
  }
  const latest = resume.versions[0] ?? null;
  const validated = validateMaster(proposedContent ?? buildMasterContent(career), career);
  const { data: version, error: versionError } = await database.from("master_resume_versions").insert({
    owner_id: ownerId,
    master_resume_id: resume.id,
    parent_version_id: latest?.id ?? null,
    version_number: (latest?.versionNumber ?? 0) + 1,
    status: "REVIEW",
    content: validated.content,
    validation_summary: validated.summary,
    career_fingerprint: career.fingerprint
  }).select("id, version_number").single();
  if (versionError || !version) throw new Error("MASTER_RESUME_VERSION_CREATE_FAILED");
  const evidence = collectResumeEvidence({ ...validated.content, target: { jobTitle: "General Executive Resume", employer: "Owner-approved Master Resume" } } as ResumeContent, career.factsByKey).map((item) => ({ owner_id: ownerId, master_resume_version_id: version.id, content_key: item.contentKey, evidence_type: item.type, evidence_id: item.id, evidence_label: item.label.slice(0, 300) }));
  if (evidence.length) {
    const { error } = await database.from("master_resume_evidence").insert(evidence);
    if (error) throw new Error("MASTER_RESUME_EVIDENCE_PERSIST_FAILED");
  }
  return { masterResumeId: resume.id, versionId: version.id, versionNumber: version.version_number };
}

export async function approveMasterResumeVersion(database: SupabaseClient, ownerId: string, versionId: string) {
  const career = await loadCareerFacts(database, ownerId);
  const { data: version, error } = await database.from("master_resume_versions").select("id, master_resume_id, status, content, career_fingerprint").eq("id", versionId).eq("owner_id", ownerId).maybeSingle();
  if (error || !version) throw new Error("MASTER_RESUME_VERSION_NOT_FOUND");
  if (version.status !== "REVIEW" || version.career_fingerprint !== career.fingerprint) throw new Error("MASTER_RESUME_REFRESH_REQUIRED");
  validateMaster(version.content, career);
  const approvedAt = new Date().toISOString();
  const { error: approveError } = await database.from("master_resume_versions").update({ status: "APPROVED", approved_at: approvedAt }).eq("id", version.id).eq("owner_id", ownerId).eq("status", "REVIEW");
  if (approveError) throw new Error("MASTER_RESUME_APPROVAL_FAILED");
  const { error: currentError } = await database.from("master_resumes").update({ current_version_id: version.id }).eq("id", version.master_resume_id).eq("owner_id", ownerId);
  if (currentError) throw new Error("MASTER_RESUME_APPROVAL_FAILED");
  return { versionId: version.id, approvedAt };
}

export async function loadApprovedMasterResume(database: SupabaseClient, ownerId: string) {
  const resume = await loadMasterResumeView(database, ownerId);
  if (!resume?.currentVersionId) return null;
  return resume.versions.find((version) => version.id === resume.currentVersionId && version.status === "APPROVED") ?? null;
}
