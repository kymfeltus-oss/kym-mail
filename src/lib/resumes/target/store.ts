import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCareerFacts } from "@/lib/resumes/career";
import { analyzeResumeTarget, JobAnalysisInputError } from "@/lib/resumes/target/analyze";
import { generateTargetResume, TargetResumeError } from "@/lib/resumes/target/generate";
import { identifyResumeTargetIntelligence, resumeTargetIntelligenceSchema } from "@/lib/resumes/target/intelligence";
import { targetConfirmationSchema, targetRequirementSchema, targetResumeContentSchema, type TargetConfirmationInput, type TargetRequirement, type TargetResumeListItem, type TargetResumeView } from "@/lib/resumes/target/types";
import { validateTargetResume } from "@/lib/resumes/target/validate";

type RequirementRow = {
  id: string;
  sequence_number: number;
  original_text: string;
  category: TargetRequirement["category"];
  importance: TargetRequirement["importance"];
  match_state: TargetRequirement["matchState"];
  explanation: string;
  matched_evidence: unknown;
  needs_confirmation: boolean;
};

function mapRequirement(row: RequirementRow): TargetRequirement {
  return targetRequirementSchema.parse({
    id: row.id,
    sequenceNumber: row.sequence_number,
    originalText: row.original_text,
    category: row.category,
    importance: row.importance,
    matchState: row.match_state,
    explanation: row.explanation,
    matchedEvidence: row.matched_evidence ?? [],
    needsConfirmation: row.needs_confirmation
  });
}

function mapError(error: unknown) {
  if (error instanceof TargetResumeError) return error;
  if (error instanceof JobAnalysisInputError) {
    if (error.code === "JOB_DESCRIPTION_MISSING") return new TargetResumeError("JOB_DESCRIPTION_MISSING", "Paste a complete job description to create this resume.");
    if (error.code === "JOB_DESCRIPTION_INCOMPLETE") return new TargetResumeError("JOB_DESCRIPTION_INCOMPLETE", "This job description does not contain enough requirements to tailor a resume.");
    if (error.code === "CAREER_PROFILE_UNAVAILABLE") return new TargetResumeError("CAREER_PROFILE_UNAVAILABLE", "Complete your Career Profile before creating a targeted resume.");
  }
  return new TargetResumeError("RESUME_TARGET_FAILED", "The targeted resume could not be completed.");
}

export async function listResumeTargets(database: SupabaseClient, ownerId: string): Promise<TargetResumeListItem[]> {
  const { data, error } = await database.from("resume_targets").select("id, title, employer, status, created_at").eq("owner_id", ownerId).order("created_at", { ascending: false });
  if (error) throw new TargetResumeError("RESUME_TARGET_UNAVAILABLE", "Targeted resumes could not be loaded.");
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, employer: row.employer, status: row.status, createdAt: row.created_at }));
}

export async function loadResumeTarget(database: SupabaseClient, ownerId: string, targetId: string): Promise<TargetResumeView | null> {
  const { data: target, error } = await database.from("resume_targets").select("id, title, employer, job_description, status, failure_message, created_at, current_version_id, intelligence, intelligence_status, intelligence_failure").eq("owner_id", ownerId).eq("id", targetId).maybeSingle();
  if (error) throw new TargetResumeError("RESUME_TARGET_UNAVAILABLE", "This targeted resume could not be loaded.");
  if (!target) return null;
  const [{ data: requirementRows, error: requirementError }, { data: confirmationRows, error: confirmationError }, { data: version, error: versionError }] = await Promise.all([
    database.from("resume_target_requirements").select("id, sequence_number, original_text, category, importance, match_state, explanation, matched_evidence, needs_confirmation").eq("owner_id", ownerId).eq("target_id", targetId).order("sequence_number"),
    database.from("resume_target_confirmations").select("requirement_id, answer, prompt_text").eq("owner_id", ownerId).eq("target_id", targetId),
    target.current_version_id
      ? database.from("resume_target_versions").select("id, version_number, content, created_at").eq("owner_id", ownerId).eq("id", target.current_version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (requirementError || confirmationError || versionError) throw new TargetResumeError("RESUME_TARGET_UNAVAILABLE", "This targeted resume could not be loaded.");
  return {
    id: target.id,
    title: target.title,
    employer: target.employer,
    jobDescription: target.job_description,
    status: target.status,
    failureMessage: target.failure_message,
    createdAt: target.created_at,
    requirements: ((requirementRows ?? []) as RequirementRow[]).map(mapRequirement),
    confirmations: (confirmationRows ?? []).map((row) => ({ requirementId: row.requirement_id, answer: row.answer, promptText: row.prompt_text })),
    currentVersion: version ? { id: version.id, versionNumber: version.version_number, content: targetResumeContentSchema.parse(version.content), createdAt: version.created_at } : null,
    intelligenceStatus: (target.intelligence_status as TargetResumeView["intelligenceStatus"] | null) ?? "NOT_RUN",
    intelligenceFailure: target.intelligence_failure ?? null,
    intelligence: target.intelligence && Object.keys(target.intelligence as object).length
      ? resumeTargetIntelligenceSchema.parse(target.intelligence)
      : null
  };
}

export async function createResumeTarget(database: SupabaseClient, ownerId: string, input: { title: string; employer: string; description: string }) {
  try {
    const career = await loadCareerFacts(database, ownerId);
    const analysis = analyzeResumeTarget({ title: input.title, employer: input.employer, description: input.description }, career);
    const { data: target, error } = await database.from("resume_targets").insert({
      owner_id: ownerId,
      title: input.title,
      employer: input.employer,
      job_description: input.description,
      description_fingerprint: analysis.fingerprint,
      status: "CONFIRMING"
    }).select("id").single();
    if (error || !target) throw new TargetResumeError("RESUME_TARGET_CREATE_FAILED", "The targeted resume could not be created.");
    const { error: requirementError } = await database.from("resume_target_requirements").insert(analysis.requirements.map((item) => ({
      owner_id: ownerId,
      target_id: target.id,
      sequence_number: item.sequenceNumber,
      original_text: item.originalText,
      category: item.category,
      importance: item.importance,
      match_state: item.matchState,
      explanation: item.explanation,
      matched_evidence: item.matchedEvidence,
      needs_confirmation: item.needsConfirmation
    })));
    if (requirementError) throw new TargetResumeError("RESUME_TARGET_CREATE_FAILED", "The targeted resume could not be created.");
    return { targetId: target.id };
  } catch (error) {
    throw mapError(error);
  }
}

export async function saveResumeTargetConfirmations(database: SupabaseClient, ownerId: string, targetId: string, confirmations: TargetConfirmationInput[]) {
  const target = await loadResumeTarget(database, ownerId, targetId);
  if (!target) throw new TargetResumeError("RESUME_TARGET_NOT_FOUND", "This targeted resume was not found.");
  const pendingIds = new Set(target.requirements.filter((item) => item.needsConfirmation).map((item) => item.id));
  const parsed = confirmations.map((item) => targetConfirmationSchema.parse(item));
  if (parsed.some((item) => !pendingIds.has(item.requirementId))) throw new TargetResumeError("CONFIRMATION_INVALID", "A confirmation does not belong to this job description.");
  for (const item of parsed) {
    if (item.answer === "YES" && item.promptText.trim().length < 20) throw new TargetResumeError("CONFIRMATION_PROMPT_REQUIRED", "If you have the experience, describe it in your own words so the resume can use it.");
    if (item.answer === "NO" && item.promptText.trim().length) throw new TargetResumeError("CONFIRMATION_INVALID", "Leave the experience note empty when you do not have the requirement.");
  }
  if (parsed.length) {
    const { error } = await database.from("resume_target_confirmations").upsert(parsed.map((item) => ({
      owner_id: ownerId,
      target_id: targetId,
      requirement_id: item.requirementId,
      answer: item.answer,
      prompt_text: item.answer === "YES" ? item.promptText.trim() : "",
      decided_at: new Date().toISOString()
    })), { onConflict: "target_id,requirement_id" });
    if (error) throw new TargetResumeError("CONFIRMATION_SAVE_FAILED", "Your confirmations could not be saved.");
  }
  return { saved: parsed.length };
}

export async function generateResumeTargetVersion(database: SupabaseClient, ownerId: string, targetId: string) {
  try {
    const target = await loadResumeTarget(database, ownerId, targetId);
    if (!target) throw new TargetResumeError("RESUME_TARGET_NOT_FOUND", "This targeted resume was not found.");
    const career = await loadCareerFacts(database, ownerId);
    const content = validateTargetResume(
      generateTargetResume({ career, title: target.title, employer: target.employer, requirements: target.requirements, confirmations: target.confirmations }),
      career,
      { title: target.title, employer: target.employer },
      target.requirements,
      target.confirmations
    );
    const nextVersion = (target.currentVersion?.versionNumber ?? 0) + 1;
    const { data: version, error } = await database.from("resume_target_versions").insert({
      owner_id: ownerId,
      target_id: targetId,
      version_number: nextVersion,
      status: "REVIEW",
      content
    }).select("id, version_number").single();
    if (error || !version) throw new TargetResumeError("RESUME_TARGET_GENERATE_FAILED", "The targeted resume could not be written.");
    const { error: activateError } = await database.from("resume_targets").update({ current_version_id: version.id, status: "READY", failure_message: null }).eq("id", targetId).eq("owner_id", ownerId);
    if (activateError) throw new TargetResumeError("RESUME_TARGET_GENERATE_FAILED", "The targeted resume could not be written.");
    return { versionId: version.id, versionNumber: version.version_number };
  } catch (error) {
    const mapped = mapError(error);
    if (mapped.code !== "CONFIRMATIONS_REQUIRED") {
      await database.from("resume_targets").update({ status: "FAILED", failure_message: mapped.message.slice(0, 500) }).eq("id", targetId).eq("owner_id", ownerId);
    }
    throw mapped;
  }
}

export async function identifyResumeTargetCompany(database: SupabaseClient, ownerId: string, targetId: string) {
  const target = await loadResumeTarget(database, ownerId, targetId);
  if (!target) throw new TargetResumeError("RESUME_TARGET_NOT_FOUND", "This targeted resume was not found.");
  try {
    const intelligence = await identifyResumeTargetIntelligence({ title: target.title, employer: target.employer, description: target.jobDescription });
    const { error } = await database.from("resume_targets").update({
      intelligence,
      intelligence_status: "COMPLETE",
      intelligence_failure: null
    }).eq("id", targetId).eq("owner_id", ownerId);
    if (error) throw new TargetResumeError("RESUME_TARGET_INTELLIGENCE_FAILED", "The hidden-employer analysis could not be saved.");
    return intelligence;
  } catch (error) {
    const mapped = error instanceof TargetResumeError ? error : new TargetResumeError("RESUME_TARGET_INTELLIGENCE_FAILED", "The hidden-employer analysis could not be completed.");
    await database.from("resume_targets").update({
      intelligence_status: "FAILED",
      intelligence_failure: mapped.message.slice(0, 500)
    }).eq("id", targetId).eq("owner_id", ownerId);
    throw mapped;
  }
}
