import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareerFacts } from "@/lib/resumes/career";
import { resumePlanSchema, type CareerEntityType, type ResumePlan } from "@/lib/resumes/types";

type RequirementRow = { id: string; importance: "REQUIRED" | "PREFERRED" | "CONTEXT"; original_text: string; normalized_concept: string | null; match_state: "STRONG_MATCH" | "MATCH" | "PARTIAL_MATCH" | "NO_MATCH" | "UNVERIFIED" | "NOT_APPLICABLE" };
type EvidenceRow = { requirement_id: string; evidence_type: CareerEntityType; evidence_id: string; evidence_label: string; evidence_excerpt: string; relevance_score: number };

const importanceBoost = { REQUIRED: 8, PREFERRED: 4, CONTEXT: 2 } as const;
const stateBoost = { STRONG_MATCH: 8, MATCH: 5, PARTIAL_MATCH: 1, NO_MATCH: -100, UNVERIFIED: -100, NOT_APPLICABLE: -100 } as const;

export async function buildResumePlan(database: SupabaseClient, ownerId: string, jobId: string, analysis: { id: string; version: number }, career: CareerFacts): Promise<ResumePlan> {
  const { data: requirementData, error: requirementError } = await database.from("job_analysis_requirements").select("id, importance, original_text, normalized_concept, match_state").eq("owner_id", ownerId).eq("analysis_id", analysis.id).order("sequence_number");
  if (requirementError) throw new Error("RESUME_PLAN_ANALYSIS_UNAVAILABLE");
  const requirements = (requirementData ?? []) as RequirementRow[];
  const ids = requirements.map((item) => item.id);
  const { data: evidenceData, error: evidenceError } = ids.length
    ? await database.from("job_analysis_evidence").select("requirement_id, evidence_type, evidence_id, evidence_label, evidence_excerpt, relevance_score").eq("owner_id", ownerId).in("requirement_id", ids)
    : { data: [], error: null };
  if (evidenceError) throw new Error("RESUME_PLAN_EVIDENCE_UNAVAILABLE");
  const requirementById = new Map(requirements.map((item) => [item.id, item]));
  const relevanceByFact = new Map<string, number>();
  const selectedEvidence = new Map<string, ResumePlan["selectedEvidence"][number]>();
  for (const item of (evidenceData ?? []) as EvidenceRow[]) {
    const requirement = requirementById.get(item.requirement_id);
    if (!requirement || !["STRONG_MATCH", "MATCH", "PARTIAL_MATCH"].includes(requirement.match_state)) continue;
    const fact = career.factsByKey.get(`${item.evidence_type}:${item.evidence_id}`);
    if (!fact) continue;
    const score = Math.max(1, Math.min(100, item.relevance_score + importanceBoost[requirement.importance] + stateBoost[requirement.match_state]));
    const key = `${item.evidence_type}:${item.evidence_id}`;
    relevanceByFact.set(key, Math.max(score, relevanceByFact.get(key) ?? 0));
    const prior = selectedEvidence.get(key);
    if (!prior || score > prior.relevance) selectedEvidence.set(key, { type: item.evidence_type, id: item.evidence_id, label: item.evidence_label, text: fact.text || item.evidence_excerpt, relevance: score });
  }

  const completeExperiences = career.experiences.filter((item) => item.completeness === "COMPLETE" && item.titleId).slice(0, 8);
  const relevantProjectIds = new Set([...selectedEvidence.values()].filter((item) => item.type === "PROJECT").map((item) => item.id));
  const experiencePlans = completeExperiences.map((experience, index) => {
    const candidates = career.accomplishments.filter((item) => item.experienceId === experience.id && (!item.projectId || !relevantProjectIds.has(item.projectId)));
    const limit = index < 2 ? 4 : index < 5 ? 3 : 2;
    const accomplishmentIds = candidates.sort((left, right) => (relevanceByFact.get(`ACCOMPLISHMENT:${right.id}`) ?? 0) - (relevanceByFact.get(`ACCOMPLISHMENT:${left.id}`) ?? 0)).slice(0, limit).map((item) => item.id);
    return { experienceId: experience.id, accomplishmentIds };
  });
  const projectIds = career.projects.filter((item) => relevantProjectIds.has(item.id)).slice(0, 2).map((item) => item.id);
  const skillIds = career.skills
    .map((skill) => ({ id: skill.id, score: relevanceByFact.get(`SKILL:${skill.id}`) ?? 0 }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 24)
    .map((item) => item.id);
  const allowedJobTerms = requirements.filter((item) => ["STRONG_MATCH", "MATCH", "PARTIAL_MATCH"].includes(item.match_state)).flatMap((item) => [item.normalized_concept, item.original_text]).filter((item): item is string => Boolean(item)).map((item) => item.trim()).filter((item, index, all) => item.length >= 2 && all.indexOf(item) === index).slice(0, 100);
  const evidence = [...selectedEvidence.values()].sort((left, right) => right.relevance - left.relevance);
  if (!evidence.length) {
    const profileFact = career.factsByKey.get(`PROFILE:${ownerId}`);
    if (profileFact) evidence.push({ ...profileFact, relevance: 50 });
  }
  return resumePlanSchema.parse({ planVersion: "gate8.v1", jobId, analysisId: analysis.id, analysisVersion: analysis.version, targetPages: 2, experiencePlans, projectIds, skillIds, allowedJobTerms, selectedEvidence: evidence });
}

