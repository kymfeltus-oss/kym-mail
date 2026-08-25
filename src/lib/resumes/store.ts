import type { SupabaseClient } from "@supabase/supabase-js";
import { resumeContentSchema, resumePlanSchema, type ResumeView } from "@/lib/resumes/types";

type VersionRow = { id: string; version_number: number; status: ResumeView["versions"][number]["status"]; generation_kind: ResumeView["versions"][number]["generationKind"]; provider_key: string; provider_mode: "DETERMINISTIC" | "AI"; content: unknown; plan: unknown; validation_summary: Record<string, unknown>; failure_code: string | null; failure_message: string | null; generated_at: string | null; stale_at: string | null; created_at: string };

export async function loadResumeView(database: SupabaseClient, ownerId: string, jobId: string): Promise<ResumeView | null> {
  const { data: resume, error } = await database.from("tailored_resumes").select("id, job_opportunity_id, current_version_id").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle();
  if (error) throw new Error("TAILORED_RESUME_UNAVAILABLE");
  if (!resume) return null;
  const { data: versions, error: versionError } = await database.from("tailored_resume_versions").select("id, version_number, status, generation_kind, provider_key, provider_mode, content, plan, validation_summary, failure_code, failure_message, generated_at, stale_at, created_at").eq("owner_id", ownerId).eq("resume_id", resume.id).order("version_number", { ascending: false });
  if (versionError) throw new Error("TAILORED_RESUME_UNAVAILABLE");
  return { id: resume.id, jobId: resume.job_opportunity_id, currentVersionId: resume.current_version_id, versions: ((versions ?? []) as VersionRow[]).map((row) => ({ id: row.id, versionNumber: row.version_number, status: row.status, generationKind: row.generation_kind, providerKey: row.provider_key, providerMode: row.provider_mode, content: row.content && Object.keys(row.content as object).length ? resumeContentSchema.parse(row.content) : null, plan: row.plan && Object.keys(row.plan as object).length ? resumePlanSchema.parse(row.plan) : null, validationSummary: row.validation_summary ?? {}, failureCode: row.failure_code, failureMessage: row.failure_message, generatedAt: row.generated_at, staleAt: row.stale_at, createdAt: row.created_at })) };
}

export function collectResumeEvidence(content: ReturnType<typeof resumeContentSchema.parse>, careerFacts: Map<string, { label: string }>) {
  const blocks = [content.summary, ...content.experiences.flatMap((item) => item.bullets), ...content.projects.flatMap((item) => item.bullets)];
  const rows = blocks.flatMap((block) => block.evidence.map((ref) => ({ contentKey: block.key, type: ref.type, id: ref.id, label: careerFacts.get(`${ref.type}:${ref.id}`)?.label ?? ref.type })));
  for (const group of content.skillGroups) for (const skill of group.skills) rows.push({ contentKey: `skill:${skill.skillId}`, type: "SKILL", id: skill.skillId, label: skill.name });
  for (const item of content.education) rows.push({ contentKey: `education:${item.educationId}`, type: "EDUCATION", id: item.educationId, label: `${item.degree} ${item.fieldOfStudy ?? ""}`.trim() });
  for (const item of content.credentials) rows.push({ contentKey: `credential:${item.credentialId}`, type: "CREDENTIAL", id: item.credentialId, label: item.name });
  return [...new Map(rows.map((row) => [`${row.contentKey}:${row.type}:${row.id}`, row])).values()];
}

