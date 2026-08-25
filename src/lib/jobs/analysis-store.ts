import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JOB_ANALYZER_VERSION,
  analysisIsStale,
  careerEvidenceFingerprint,
  type CareerEvidence,
  type JobAnalysisResult,
  type JobAnalysisStatus,
  type RequirementCategory,
  type RequirementGapReason,
  type RequirementImportance,
  type RequirementMatchState
} from "@/lib/jobs/analysis";
import type { JobAnalysisSummaryView, JobAnalysisView, RequirementView } from "@/lib/jobs/analysis-view";

const STUCK_ANALYZING_MS = 120_000;

type AnalysisRow = {
  id: string;
  analysis_version: number;
  status: JobAnalysisStatus;
  description_fingerprint: string;
  career_fingerprint: string;
  overall_score: number | null;
  failure_code: string | null;
  failure_message: string | null;
  completed_at: string | null;
  stale_at: string | null;
  started_at: string;
  result_summary: JobAnalysisSummaryView;
};

type RequirementRow = {
  id: string;
  sequence_number: number;
  importance: RequirementImportance;
  category: RequirementCategory;
  original_text: string;
  normalized_concept: string | null;
  match_state: RequirementMatchState;
  explanation: string;
  gap_reason: RequirementGapReason | null;
  is_material: boolean;
};

type EvidenceRow = {
  id: string;
  requirement_id: string;
  evidence_type: string;
  evidence_label: string;
  evidence_excerpt: string;
  match_explanation: string;
  relevance_score: number;
};

export function selectDisplayAnalysis<T extends { status: JobAnalysisStatus }>(rows: T[]) {
  const latest = rows[0] ?? null;
  const lastSuccessful = rows.find((row) => row.status === "COMPLETE" || row.status === "STALE") ?? null;
  return { latest, lastSuccessful };
}

async function loadRequirements(database: SupabaseClient, ownerId: string, analysisId: string): Promise<RequirementView[]> {
  const { data: requirements, error: requirementError } = await database
    .from("job_analysis_requirements")
    .select("id, sequence_number, importance, category, original_text, normalized_concept, match_state, explanation, gap_reason, is_material")
    .eq("owner_id", ownerId)
    .eq("analysis_id", analysisId)
    .order("sequence_number");
  if (requirementError) throw new Error("JOB_ANALYSIS_UNAVAILABLE");
  const requirementRows = (requirements ?? []) as RequirementRow[];
  const requirementIds = requirementRows.map((item) => item.id);
  const { data: evidence, error: evidenceError } = requirementIds.length
    ? await database.from("job_analysis_evidence").select("id, requirement_id, evidence_type, evidence_label, evidence_excerpt, match_explanation, relevance_score").eq("owner_id", ownerId).in("requirement_id", requirementIds)
    : { data: [], error: null };
  if (evidenceError) throw new Error("JOB_ANALYSIS_UNAVAILABLE");
  const evidenceByRequirement = new Map<string, EvidenceRow[]>();
  for (const item of (evidence ?? []) as EvidenceRow[]) evidenceByRequirement.set(item.requirement_id, [...(evidenceByRequirement.get(item.requirement_id) ?? []), item]);
  return requirementRows.map((requirement) => ({
    id: requirement.id,
    sequenceNumber: requirement.sequence_number,
    importance: requirement.importance,
    category: requirement.category,
    originalText: requirement.original_text,
    normalizedConcept: requirement.normalized_concept,
    matchState: requirement.match_state,
    explanation: requirement.explanation,
    gapReason: requirement.gap_reason,
    isMaterial: requirement.is_material,
    evidence: (evidenceByRequirement.get(requirement.id) ?? [])
      .sort((left, right) => right.relevance_score - left.relevance_score)
      .map((item) => ({
        id: item.id,
        type: item.evidence_type,
        label: item.evidence_label,
        excerpt: item.evidence_excerpt,
        explanation: item.match_explanation,
        relevanceScore: item.relevance_score
      }))
  }));
}

function toView(row: AnalysisRow, requirements: RequirementView[], extras: Partial<JobAnalysisView> = {}): JobAnalysisView {
  return {
    id: row.id,
    version: row.analysis_version,
    status: row.status,
    overallScore: row.overall_score,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    completedAt: row.completed_at,
    staleAt: row.stale_at,
    descriptionFingerprint: row.description_fingerprint,
    careerFingerprint: row.career_fingerprint,
    startedAt: row.started_at,
    previousSuccessPreserved: false,
    lastSuccessfulCompletedAt: row.completed_at,
    summary: row.result_summary ?? {},
    requirements,
    ...extras
  };
}

export async function loadJobAnalysisView(database: SupabaseClient, ownerId: string, jobId: string): Promise<JobAnalysisView | null> {
  const { data: analyses, error } = await database
    .from("job_analyses")
    .select("id, analysis_version, status, description_fingerprint, career_fingerprint, overall_score, failure_code, failure_message, completed_at, stale_at, started_at, result_summary")
    .eq("owner_id", ownerId)
    .eq("job_opportunity_id", jobId)
    .order("analysis_version", { ascending: false })
    .limit(10);
  if (error) throw new Error("JOB_ANALYSIS_UNAVAILABLE");
  const rows = (analyses ?? []) as AnalysisRow[];
  const { latest, lastSuccessful } = selectDisplayAnalysis(rows);
  if (!latest) return null;

  if (latest.status === "ANALYZING" || latest.status === "FAILED") {
    const successfulRequirements = lastSuccessful ? await loadRequirements(database, ownerId, lastSuccessful.id) : [];
    const latestRequirements = latest.status === "FAILED" && latest.id !== lastSuccessful?.id ? await loadRequirements(database, ownerId, latest.id) : successfulRequirements;
    const source = lastSuccessful && successfulRequirements.length ? lastSuccessful : latest;
    return toView(source, lastSuccessful && successfulRequirements.length ? successfulRequirements : latestRequirements, {
      id: latest.id,
      version: latest.analysis_version,
      status: latest.status,
      failureCode: latest.failure_code,
      failureMessage: latest.failure_message,
      startedAt: latest.started_at,
      previousSuccessPreserved: Boolean(lastSuccessful && successfulRequirements.length && lastSuccessful.id !== latest.id),
      lastSuccessfulCompletedAt: lastSuccessful?.completed_at ?? null,
      overallScore: lastSuccessful?.overall_score ?? latest.overall_score,
      summary: (lastSuccessful?.result_summary ?? latest.result_summary) ?? {}
    });
  }

  const requirements = await loadRequirements(database, ownerId, latest.id);
  return toView(latest, requirements);
}

export async function recoverStuckAnalysis<T extends Pick<JobAnalysisView, "id" | "status" | "startedAt">>(database: SupabaseClient, ownerId: string, analysis: T): Promise<T> {
  if (analysis.status !== "ANALYZING" || !analysis.startedAt) return analysis;
  if (Date.now() - new Date(analysis.startedAt).getTime() < STUCK_ANALYZING_MS) return analysis;
  await database.from("job_analyses").update({
    status: "FAILED",
    failure_code: "INTERRUPTED_ANALYSIS",
    failure_message: "A previous analysis did not finish. The last successful analysis remains available. It is safe to retry."
  }).eq("id", analysis.id).eq("owner_id", ownerId);
  return { ...analysis, status: "FAILED", failureCode: "INTERRUPTED_ANALYSIS", failureMessage: "A previous analysis did not finish. The last successful analysis remains available. It is safe to retry." } as T;
}

export async function markAnalysisStaleIfNeeded(
  database: SupabaseClient,
  ownerId: string,
  analysis: JobAnalysisView,
  description: string,
  careerEvidence?: CareerEvidence[]
) {
  if (analysis.status !== "COMPLETE") return analysis;
  if (!analysis.descriptionFingerprint) return analysis;
  const descriptionChanged = analysisIsStale(analysis.descriptionFingerprint, description);
  const careerChanged = careerEvidence && analysis.careerFingerprint ? analysis.careerFingerprint !== careerEvidenceFingerprint(careerEvidence) : false;
  if (!descriptionChanged && !careerChanged) return analysis;
  await database.from("job_analyses").update({ status: "STALE", stale_at: new Date().toISOString() }).eq("id", analysis.id).eq("owner_id", ownerId);
  return { ...analysis, status: "STALE" as const, staleAt: new Date().toISOString() };
}

export async function persistCompletedAnalysis(
  database: SupabaseClient,
  ownerId: string,
  jobId: string,
  analysisId: string,
  result: JobAnalysisResult,
  careerEvidence: CareerEvidence[]
) {
  const requirementRows = result.requirements.map((requirement) => ({
    owner_id: ownerId,
    analysis_id: analysisId,
    sequence_number: requirement.sequenceNumber,
    importance: requirement.importance,
    category: requirement.category,
    original_text: requirement.originalText,
    normalized_text: requirement.normalizedText,
    normalized_concept: requirement.normalizedConcept,
    match_state: requirement.matchState,
    match_confidence: requirement.matchConfidence,
    scoring_weight: requirement.scoringWeight,
    score_contribution: requirement.scoreContribution,
    explanation: requirement.explanation,
    gap_reason: requirement.gapReason,
    is_material: requirement.isMaterial
  }));
  const { data: persistedRequirements, error: requirementsError } = await database.from("job_analysis_requirements").insert(requirementRows).select("id, sequence_number");
  if (requirementsError || !persistedRequirements) throw new Error("REQUIREMENTS_PERSIST_FAILED");
  const requirementIdBySequence = new Map(persistedRequirements.map((item) => [Number(item.sequence_number), item.id]));
  const evidenceRows = result.requirements.flatMap((requirement) => requirement.evidence.map((match) => ({
    owner_id: ownerId,
    requirement_id: requirementIdBySequence.get(requirement.sequenceNumber),
    evidence_type: match.evidence.type,
    evidence_id: match.evidence.id,
    relevance_score: match.relevanceScore,
    evidence_label: match.evidence.label.slice(0, 300),
    evidence_excerpt: match.evidence.text.slice(0, 2000),
    match_explanation: match.explanation.slice(0, 1000)
  })));
  if (evidenceRows.some((row) => !row.requirement_id)) throw new Error("EVIDENCE_REQUIREMENT_MISSING");
  if (evidenceRows.length) {
    const { error: evidenceError } = await database.from("job_analysis_evidence").insert(evidenceRows);
    if (evidenceError) throw new Error("EVIDENCE_PERSIST_FAILED");
  }
  const { error: staleError } = await database.from("job_analyses").update({
    status: "STALE",
    stale_at: new Date().toISOString()
  }).eq("owner_id", ownerId).eq("job_opportunity_id", jobId).eq("status", "COMPLETE").neq("id", analysisId);
  if (staleError) throw new Error("PRIOR_ANALYSIS_SUPERSEDE_FAILED");
  const { error: completionError } = await database.from("job_analyses").update({
    status: "COMPLETE",
    analyzer_version: JOB_ANALYZER_VERSION,
    career_fingerprint: careerEvidenceFingerprint(careerEvidence),
    job_snapshot: result.jobSnapshot,
    result_summary: { ...result.summary, scoreBreakdown: result.scoreBreakdown },
    overall_score: result.overallScore,
    completed_at: new Date().toISOString(),
    failure_code: null,
    failure_message: null
  }).eq("id", analysisId).eq("owner_id", ownerId);
  if (completionError) throw new Error("ANALYSIS_COMPLETION_FAILED");
}