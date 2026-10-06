import type { CareerFacts } from "@/lib/resumes/career";
import type { TargetRequirement } from "@/lib/resumes/target/types";

const confirmationStates = new Set<TargetRequirement["matchState"]>(["NO_MATCH", "UNVERIFIED", "PARTIAL_MATCH"]);

const accountingCareerPattern = /\b(accountant|accounting|controller|comptroller|cfo|finance|financial reporting|corporate accounting|close|consolidat\w*)\b/i;

const coreAccountingPattern = /\b(internal controls?|asc\s*606|revenue recognition|gaap|sox\b|sarbanes[\s-]*oxley|month-?end|financial close|accounting close|close process|consolidat\w*|journal entr\w*|reconcil\w*|general ledger|accounts payable|accounts receivable|financial reporting|corporate accounting|accounting operations|accruals?|intercompany|flux analysis|variance analysis)\b/i;

const outsideAccountingPattern = /\b(\d+\+?\s*years|bachelor|master'?s|mba|cpa\b|license|certified|degree)\b/i;

export function careerCoversAccountingOperations(career: CareerFacts) {
  const record = [
    career.profile.headline,
    career.profile.summary,
    ...career.titles.map((item) => item.name),
    ...career.experiences.flatMap((item) => [item.summary]),
    ...career.skills.map((item) => item.name)
  ].filter((item): item is string => Boolean(item)).join(" ");
  return accountingCareerPattern.test(record);
}

export function isCoreAccountingQualification(requirement: Pick<TargetRequirement, "category" | "originalText">) {
  if (["TECHNOLOGY", "SYSTEM", "CERTIFICATION", "EDUCATION", "INDUSTRY"].includes(requirement.category)) return false;
  if (outsideAccountingPattern.test(requirement.originalText)) return false;
  return coreAccountingPattern.test(requirement.originalText);
}

export function qualificationNeedsConfirmation(
  requirement: Pick<TargetRequirement, "importance" | "matchState" | "category" | "originalText">,
  career: CareerFacts
) {
  if (requirement.importance !== "REQUIRED") return false;
  if (!confirmationStates.has(requirement.matchState)) return false;
  if (careerCoversAccountingOperations(career) && isCoreAccountingQualification(requirement)) return false;
  return true;
}
