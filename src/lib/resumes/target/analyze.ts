import { analyzeJobDescription, JobAnalysisInputError, fingerprint, type CareerEvidence, type CareerEvidenceType } from "@/lib/jobs/analysis";
import type { CareerFacts } from "@/lib/resumes/career";
import type { TargetRequirement } from "@/lib/resumes/target/types";

export { JobAnalysisInputError, fingerprint };

const confirmationStates = new Set(["NO_MATCH", "UNVERIFIED", "PARTIAL_MATCH"]);
const evidenceTypes = new Set<CareerEvidenceType>(["PROFILE", "EXPERIENCE", "EDUCATION", "CREDENTIAL", "SKILL", "PROJECT", "ACCOMPLISHMENT", "METRIC"]);

export function careerFactsToEvidence(career: CareerFacts): CareerEvidence[] {
  return [...career.factsByKey.values()].flatMap((fact) => {
    if (!evidenceTypes.has(fact.type as CareerEvidenceType)) return [];
    return [{
      id: fact.id,
      type: fact.type as CareerEvidenceType,
      label: fact.label,
      text: fact.text,
      metadata: { authorityStatus: "AUTHORITATIVE" as const }
    }];
  });
}

export function needsTargetConfirmation(matchState: TargetRequirement["matchState"]) {
  return confirmationStates.has(matchState);
}

export function analyzeResumeTarget(input: { title: string; employer: string; description: string }, career: CareerFacts) {
  const result = analyzeJobDescription(
    { id: "resume-target", title: input.title, employer: input.employer, location: null, description: input.description },
    careerFactsToEvidence(career)
  );
  const requirements = result.requirements.map((item) => ({
    sequenceNumber: item.sequenceNumber,
    originalText: item.originalText,
    category: item.category,
    importance: item.importance,
    matchState: item.matchState,
    explanation: item.explanation.slice(0, 2000),
    matchedEvidence: item.evidence.slice(0, 8).map((match) => ({
      type: match.evidence.type,
      id: match.evidence.id,
      label: match.evidence.label.slice(0, 300),
      excerpt: match.evidence.text.slice(0, 800)
    })),
    needsConfirmation: needsTargetConfirmation(item.matchState)
  }));
  return {
    fingerprint: fingerprint(input.description),
    requirements,
    matched: requirements.filter((item) => item.matchState === "STRONG_MATCH" || item.matchState === "MATCH"),
    pendingConfirmations: requirements.filter((item) => item.needsConfirmation)
  };
}
