import { createHash } from "crypto";
import { z } from "zod";

export const JOB_ANALYZER_VERSION = "deterministic-evidence-v2";
export const SCORING_MODEL_ID = "weighted-requirement-v2";

export type JobAnalysisStatus = "NOT_ANALYZED" | "ANALYZING" | "COMPLETE" | "FAILED" | "STALE";
export type RequirementImportance = "REQUIRED" | "PREFERRED" | "RESPONSIBILITY" | "CONTEXT";
export type RequirementCategory =
  | "RESPONSIBILITY"
  | "SKILL"
  | "TECHNOLOGY"
  | "SYSTEM"
  | "ACCOUNTING"
  | "FINANCE"
  | "DATA"
  | "EDUCATION"
  | "CERTIFICATION"
  | "EXPERIENCE"
  | "LEADERSHIP"
  | "INDUSTRY"
  | "OTHER";
export type RequirementMatchState = "STRONG_MATCH" | "MATCH" | "PARTIAL_MATCH" | "NO_MATCH" | "UNVERIFIED" | "NOT_APPLICABLE";
export type RequirementGapReason =
  | "CERTIFICATION_NOT_HELD"
  | "TECHNOLOGY_ABSENT"
  | "INDUSTRY_EXPERIENCE_ABSENT"
  | "EDUCATION_MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "UNVERIFIABLE"
  | "YEARS_INSUFFICIENT";
export type CareerEvidenceType = "PROFILE" | "EXPERIENCE" | "EDUCATION" | "CREDENTIAL" | "SKILL" | "PROJECT" | "ACCOMPLISHMENT" | "METRIC";
export type DescriptionReadiness = "MISSING" | "INCOMPLETE" | "READY";

export const MATCH_STATE_CRITERIA: Record<RequirementMatchState, string> = {
  STRONG_MATCH: "Deterministic relevance is 82 or higher: strong token coverage, a direct evidence-label or canonical-concept match, or fully met years-of-experience evidence.",
  MATCH: "Deterministic relevance is 62–81: compatible Master Career Profile evidence covers most of the requirement.",
  PARTIAL_MATCH: "Deterministic relevance is 30–61: related authoritative evidence exists but does not fully establish the requirement. Related concepts cannot become a strong match on relatedness alone.",
  NO_MATCH: "A closed-world requirement was evaluated against the Master Career Profile and no supporting authoritative evidence exists.",
  UNVERIFIED: "The Master Career Profile does not contain enough information to determine whether the requirement is met. Unknown is not treated as absence.",
  NOT_APPLICABLE: "The item is legal, compensation, benefits, or authorization language and is excluded from scoring."
};

export const IMPORTANCE_WEIGHTS: Record<RequirementImportance, number> = { REQUIRED: 5, PREFERRED: 2, RESPONSIBILITY: 3, CONTEXT: 1 };
export const MATCH_STATE_VALUES: Record<RequirementMatchState, number> = {
  STRONG_MATCH: 1,
  MATCH: 0.8,
  PARTIAL_MATCH: 0.45,
  NO_MATCH: 0,
  UNVERIFIED: 0,
  NOT_APPLICABLE: 0
};
export const UNSCORED_STATES: RequirementMatchState[] = ["NOT_APPLICABLE", "UNVERIFIED"];

export type JobAnalysisInput = {
  id: string;
  title: string;
  employer: string;
  location: string | null;
  description: string;
};

export type CareerEvidence = {
  id: string;
  type: CareerEvidenceType;
  label: string;
  text: string;
  category?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  updatedAt?: string | null;
};

export type ExtractedRequirement = {
  sequenceNumber: number;
  importance: RequirementImportance;
  category: RequirementCategory;
  originalText: string;
  normalizedText: string;
  normalizedConcept: string | null;
};

export type RequirementEvidenceMatch = {
  evidence: CareerEvidence;
  relevanceScore: number;
  explanation: string;
};

export type RankingHint = {
  evidenceId: string;
  relevance: number;
  explanation: string;
};

export type MatchedRequirement = ExtractedRequirement & {
  matchState: RequirementMatchState;
  matchConfidence: number;
  scoringWeight: number;
  scoreContribution: number;
  explanation: string;
  gapReason: RequirementGapReason | null;
  isMaterial: boolean;
  evidence: RequirementEvidenceMatch[];
};

export type ScoreSlice = { count: number; earnedPoints: number; possiblePoints: number; score: number | null };

export type ScoreBreakdown = {
  model: typeof SCORING_MODEL_ID;
  overallScore: number;
  earnedPoints: number;
  possiblePoints: number;
  unverifiedCount: number;
  weights: typeof IMPORTANCE_WEIGHTS;
  values: typeof MATCH_STATE_VALUES;
  byImportance: Record<RequirementImportance, ScoreSlice>;
  byCategory: Partial<Record<RequirementCategory, ScoreSlice>>;
  byState: Record<RequirementMatchState, number>;
  explanation: string;
};

export type JobAnalysisResult = {
  requirements: MatchedRequirement[];
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  summary: {
    requirementCount: number;
    requiredCount: number;
    preferredCount: number;
    responsibilityCount: number;
    strongMatchCount: number;
    matchCount: number;
    partialMatchCount: number;
    gapCount: number;
    unverifiedCount: number;
    notApplicableCount: number;
    materialGapCount: number;
    strongestAreas: string[];
    gaps: string[];
    materialGaps: string[];
    scoreExplanation: string;
    whyYouMatch: string[];
    whereYouDont: string[];
    resumeUnderselling: string[];
    recommendedResumeStrategy: string[];
  };
  jobSnapshot: {
    title: string;
    employer: string;
    location: string | null;
    seniority: string;
  };
};

export class JobAnalysisInputError extends Error {
  readonly code: "JOB_DESCRIPTION_MISSING" | "JOB_DESCRIPTION_INCOMPLETE" | "CAREER_PROFILE_UNAVAILABLE" | "INVALID_EXTRACTION" | "ANALYSIS_TIMEOUT";

  constructor(code: JobAnalysisInputError["code"], message: string) {
    super(message);
    this.name = "JobAnalysisInputError";
    this.code = code;
  }
}

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "its", "of", "on", "or", "our",
  "that", "the", "their", "this", "to", "we", "will", "with", "you", "your", "role", "candidate", "position", "ability",
  "including", "such", "must", "need", "able"
]);

const canonicalTerms: Record<string, string> = {
  led: "lead", leading: "lead", leadership: "lead", leader: "lead",
  managed: "manage", managing: "manage", management: "manage", manager: "manage",
  automated: "automation", automating: "automation", automate: "automation",
  reconciliations: "reconciliation", reconciled: "reconciliation",
  controls: "control", controlled: "control",
  systems: "system", platforms: "platform", technologies: "technology",
  finances: "finance", financial: "finance", accounting: "accounting",
  analyses: "analysis", analytical: "analysis", analytics: "analysis",
  transformations: "transformation", transformed: "transformation",
  bachelors: "bachelor", bachelorsdegree: "bachelor", baccalaureate: "bachelor",
  certified: "certification", certificate: "certification",
  sqlserver: "sql", powerbi: "powerbi", workdayfinancials: "workday",
  gaap: "gaap", asc606: "asc606", netsuite: "netsuite", hyperion: "hyperion"
};

const preferredPattern = /\b(preferred|desired|ideally|nice to have|a plus|bonus|advantageous)\b/i;
const contextPattern = /\b(about us|our company|benefits|compensation|equal opportunity|eeo|accommodation|apply now|what we offer)\b/i;
const notApplicablePattern = /\b(work authorization|authorized to work|visa sponsor|citizenship|equal opportunity|eeo|background check|drug (?:test|screen)|physical (?:demand|requirement)|reasonable accommodation|benefits include|life\s*&\s*add|403b|flexible spending account|paid time off|mandatory vaccination|covid-19 vaccinations?|salary range|compensation|relocation assistance|travel up to|weekends|overtime)\b/i;
const hardNotApplicablePattern = /\b(equal opportunity|eeo|benefits include|life\s*&\s*add|403b|flexible spending account|paid time off|mandatory vaccination|covid-19 vaccinations?)\b/i;
const responsibilityPattern = /\b(responsib|duties|oversee|lead|manage|develop|build|prepare|direct|drive|partner|own|ensure|coordinate|deliver|support|maintain|implement)\w*/i;
const educationPattern = /\b(bachelor|master'?s|degree|b\.s\.|mba|education)\b/i;
const certificationPattern = /\b(cpa|cma|cfa|cia|certif|license|licensed)\w*/i;
const experiencePattern = /\b(\d{1,2}\+?\s*(?:years?|yrs?)|years? of experience|experience (?:in|with)|proven experience)\b/i;
const leadershipPattern = /\b(leadership|lead|manage|manager|director|executive|team|mentor|stakeholder|cross-functional|strategic)\w*/i;
const technologyPattern = /\b(sap|workday|oracle|netsuite|erp|sql|python|power\s*bi|tableau|excel|snowflake|hyperion|blackline|anaplan|adaptive|coupa|salesforce|kubernetes|system|platform|technology|automation|database)\b/i;
const accountingPattern = /\b(accounting|finance|financial|gaap|asc\s*\d+|revenue recognition|close|consolidation|audit|sox|control|forecast|budget|ledger|reconciliation|reporting|controller|treasury|tax)\w*/i;
const industryPattern = /\b(healthcare|hospitality|retail|manufacturing|pharmaceutical|software|saas|insurance|banking|energy|public company|industry)\b/i;
const systemPattern = /\b(sap|workday|oracle|netsuite|erp|hyperion|blackline|anaplan|coupa)\b/i;
const technologyNamePattern = /\b(sql|python|power\s*bi|tableau|excel|javascript|vba|alteryx|salesforce|kubernetes)\b/i;
const dataPattern = /\b(data pipeline|data warehouse|analytics|etl|snowflake)\b/i;
const promptInjectionPattern = /\b(?:ignore|disregard|override|forget)\b.{0,100}\b(?:previous|prior|system|developer|instructions?|prompt)\b|\b(?:mark|rate|score)\b.{0,60}\b(?:candidate|applicant)\b.{0,60}\b(?:perfect|100(?:\s*percent|%)?)\b|\b(?:invent|fabricate|make up)\b/i;

export function decodeJobDescription(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeAnalysisText(value: string) {
  return decodeJobDescription(value).replace(/\s+/g, " ").trim();
}

export function sanitizeStoredJobDescription(value: string) {
  return decodeJobDescription(value).slice(0, 30000);
}

function stemToken(token: string) {
  const canonical = canonicalTerms[token];
  if (canonical) return canonical;
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenizeAnalysisText(value: string) {
  const prepared = normalizeAnalysisText(value)
    .toLowerCase()
    .replace(/asc\s*606/g, "asc606")
    .replace(/power\s*bi/g, "powerbi")
    .replace(/sql\s*server/g, "sqlserver")
    .replace(/workday\s*financials/g, "workdayfinancials");
  return [...new Set(prepared.replace(/[^a-z0-9+]+/g, " ").split(" ").filter(Boolean).map(stemToken).filter((token) => token.length > 1 && !stopWords.has(token)))];
}

export function fingerprint(value: string) {
  return createHash("sha256").update(normalizeAnalysisText(value)).digest("hex");
}

export function careerEvidenceFingerprint(evidence: CareerEvidence[]) {
  const stable = evidence
    .map((item) => `${item.type}:${item.id}:${item.updatedAt ?? ""}:${normalizeAnalysisText(item.text)}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(stable).digest("hex");
}

export function classifyJobDescription(description: string): DescriptionReadiness {
  const normalized = normalizeAnalysisText(description);
  if (!normalized) return "MISSING";
  if (normalized.length < 120 || normalized.split(/\s+/).length < 20) return "INCOMPLETE";
  return "READY";
}

type ConceptDefinition = { concept: string; aliases: string[]; related: string[]; closedWorld: boolean };

const CONCEPTS: ConceptDefinition[] = [
  { concept: "netsuite", aliases: ["oracle netsuite", "netsuite"], related: ["oracle", "erp"], closedWorld: true },
  { concept: "workday", aliases: ["workday financials", "workday"], related: ["erp"], closedWorld: true },
  { concept: "sap", aliases: ["sap"], related: ["erp"], closedWorld: true },
  { concept: "oracle", aliases: ["oracle erp", "oracle ebs", "oracle"], related: ["netsuite", "erp"], closedWorld: true },
  { concept: "salesforce", aliases: ["salesforce"], related: [], closedWorld: true },
  { concept: "python", aliases: ["python"], related: [], closedWorld: true },
  { concept: "sql", aliases: ["sql server", "sql"], related: [], closedWorld: true },
  { concept: "powerbi", aliases: ["power bi", "powerbi"], related: ["tableau"], closedWorld: true },
  { concept: "tableau", aliases: ["tableau"], related: ["powerbi"], closedWorld: true },
  { concept: "snowflake", aliases: ["snowflake"], related: [], closedWorld: true },
  { concept: "hyperion", aliases: ["hyperion"], related: [], closedWorld: true },
  { concept: "kubernetes", aliases: ["kubernetes"], related: [], closedWorld: true },
  { concept: "asc606", aliases: ["asc-606", "asc 606", "asc606"], related: ["revenue-recognition"], closedWorld: false },
  { concept: "revenue-recognition", aliases: ["revenue recognition", "revenue accounting"], related: ["asc606"], closedWorld: false },
  { concept: "cpa", aliases: ["certified public accountant", "cpa"], related: [], closedWorld: true },
  { concept: "cma", aliases: ["cma"], related: [], closedWorld: true },
  { concept: "mba", aliases: ["master of business administration", "mba"], related: [], closedWorld: true },
  { concept: "bachelor-accounting", aliases: ["b.s. in accounting", "bachelor of science in accounting", "degree in accounting"], related: [], closedWorld: true }
];

export function detectNormalizedConcepts(text: string) {
  const haystack = normalizeAnalysisText(text).toLowerCase();
  const matches: Array<{ concept: string; aliasLength: number }> = [];
  if (/\bbachelor'?s?\b/.test(haystack) && /\baccounting\b/.test(haystack)) {
    matches.push({ concept: "bachelor-accounting", aliasLength: 100 });
  }
  for (const item of CONCEPTS) {
    const aliasLength = item.aliases.reduce((best, alias) => haystack.includes(alias) ? Math.max(best, alias.length) : best, 0);
    if (aliasLength) matches.push({ concept: item.concept, aliasLength });
  }
  return [...new Set(matches.sort((left, right) => right.aliasLength - left.aliasLength || left.concept.localeCompare(right.concept)).map((item) => item.concept))];
}

export function detectNormalizedConcept(text: string) {
  return detectNormalizedConcepts(text)[0] ?? null;
}

export function relatedConcepts(concept: string | null) {
  if (!concept) return [];
  return CONCEPTS.find((item) => item.concept === concept)?.related ?? [];
}

export function isClosedWorldConcept(concept: string | null) {
  if (!concept) return false;
  return CONCEPTS.find((item) => item.concept === concept)?.closedWorld === true;
}

function requirementCategory(text: string): RequirementCategory {
  if (educationPattern.test(text)) return "EDUCATION";
  if (certificationPattern.test(text)) return "CERTIFICATION";
  if (systemPattern.test(text)) return "SYSTEM";
  if (dataPattern.test(text)) return "DATA";
  if (technologyNamePattern.test(text)) return "TECHNOLOGY";
  if (experiencePattern.test(text)) return "EXPERIENCE";
  if (/\b(gaap|asc\s*\d+|revenue recognition|close|consolidation|audit|sox|ledger|reconciliation)\b/i.test(text)) return "ACCOUNTING";
  if (/\b(fp&a|forecast|budget|treasury|financial planning|finance transformation)\b/i.test(text)) return "FINANCE";
  if (leadershipPattern.test(text)) return "LEADERSHIP";
  if (technologyPattern.test(text)) return "TECHNOLOGY";
  if (accountingPattern.test(text)) return "ACCOUNTING";
  if (industryPattern.test(text)) return "INDUSTRY";
  if (responsibilityPattern.test(text)) return "RESPONSIBILITY";
  if (/\b(skill|knowledge|proficien|expert|capab|communication|collaboration)\w*/i.test(text)) return "SKILL";
  return "OTHER";
}

function requirementImportance(text: string, section: RequirementImportance): RequirementImportance {
  if (preferredPattern.test(text)) return "PREFERRED";
  if (/\b(required|must|minimum|need to)\b/i.test(text)) return "REQUIRED";
  if (section === "RESPONSIBILITY" || /\b(responsible for|you will|what you'?ll do|duties include)\b/i.test(text)) return "RESPONSIBILITY";
  return section;
}

function looksLikeRequirement(text: string) {
  if (text.length < 12) return false;
  if (promptInjectionPattern.test(text)) return false;
  if (notApplicablePattern.test(text)) return true;
  if (contextPattern.test(text)) return false;
  return responsibilityPattern.test(text)
    || educationPattern.test(text)
    || certificationPattern.test(text)
    || experiencePattern.test(text)
    || leadershipPattern.test(text)
    || technologyPattern.test(text)
    || accountingPattern.test(text)
    || industryPattern.test(text)
    || /\b(required|preferred|qualification|knowledge|proficien|expert|skill)\w*/i.test(text);
}

function splitRequirementText(description: string) {
  const lines = decodeJobDescription(description)
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+[•·]\s+/))
    .map((line) => line.replace(/^[\s•·*\-–—]+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  const output: Array<{ text: string; section: RequirementImportance }> = [];
  let section: RequirementImportance = "CONTEXT";

  for (const line of lines) {
    if (/^(preferred|desired)( qualifications| skills| experience)?\s*:?”?$/i.test(line)) {
      section = "PREFERRED";
      continue;
    }
    if (/^(responsibilities|what you.ll do|duties)\s*:?”?$/i.test(line)) {
      section = "RESPONSIBILITY";
      continue;
    }
    if (/^(required|minimum|basic)?\s*(qualifications|requirements)\s*:?”?$/i.test(line)) {
      section = "REQUIRED";
      continue;
    }
    const parts = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])|\s*[;•]\s*/).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) output.push({ text: part.slice(0, 2000), section });
  }
  return output;
}

export function extractJobRequirements(description: string): ExtractedRequirement[] {
  const readiness = classifyJobDescription(description);
  if (readiness === "MISSING") throw new JobAnalysisInputError("JOB_DESCRIPTION_MISSING", "This saved job has no description to analyze.");
  if (readiness === "INCOMPLETE") throw new JobAnalysisInputError("JOB_DESCRIPTION_INCOMPLETE", "This job description is too incomplete for a defensible match analysis.");

  const seen = new Set<string>();
  const requirements: ExtractedRequirement[] = [];
  for (const candidate of splitRequirementText(description)) {
    const text = normalizeAnalysisText(candidate.text);
    if (!looksLikeRequirement(text)) continue;
    const normalizedText = text.toLowerCase();
    const dedupeKey = normalizedText.replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    requirements.push({
      sequenceNumber: requirements.length + 1,
      importance: requirementImportance(text, candidate.section),
      category: requirementCategory(text),
      originalText: text,
      normalizedText,
      normalizedConcept: detectNormalizedConcept(text)
    });
    if (requirements.length === 80) break;
  }

  if (requirements.length < 2) {
    throw new JobAnalysisInputError("JOB_DESCRIPTION_INCOMPLETE", "The available description does not contain enough structured requirements for a defensible analysis.");
  }
  return requirements;
}

export function groundRequirements(description: string, requirements: ExtractedRequirement[]): ExtractedRequirement[] {
  const haystack = normalizeAnalysisText(description).toLowerCase();
  const grounded = requirements.filter((requirement) => {
    const wording = normalizeAnalysisText(requirement.originalText);
    return !promptInjectionPattern.test(wording) && haystack.includes(wording.toLowerCase());
  });
  return grounded.map((requirement, index) => {
    const originalText = normalizeAnalysisText(requirement.originalText);
    return {
      sequenceNumber: index + 1,
      importance: requirement.importance,
      category: requirementCategory(originalText),
      originalText,
      normalizedText: originalText.toLowerCase(),
      normalizedConcept: detectNormalizedConcept(originalText)
    };
  });
}

const compatibleEvidence: Record<RequirementCategory, CareerEvidenceType[]> = {
  RESPONSIBILITY: ["EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "METRIC", "SKILL"],
  SKILL: ["SKILL", "EXPERIENCE", "PROJECT", "ACCOMPLISHMENT"],
  TECHNOLOGY: ["SKILL", "PROJECT", "ACCOMPLISHMENT", "EXPERIENCE"],
  SYSTEM: ["SKILL", "PROJECT", "ACCOMPLISHMENT", "EXPERIENCE"],
  ACCOUNTING: ["SKILL", "EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "METRIC", "CREDENTIAL", "EDUCATION"],
  FINANCE: ["SKILL", "EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "METRIC", "CREDENTIAL"],
  DATA: ["SKILL", "PROJECT", "ACCOMPLISHMENT", "EXPERIENCE", "METRIC"],
  EDUCATION: ["EDUCATION"],
  CERTIFICATION: ["CREDENTIAL"],
  EXPERIENCE: ["PROFILE", "EXPERIENCE", "PROJECT", "ACCOMPLISHMENT"],
  LEADERSHIP: ["EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "SKILL"],
  INDUSTRY: ["EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "SKILL"],
  OTHER: ["PROFILE", "EXPERIENCE", "PROJECT", "ACCOMPLISHMENT", "SKILL", "EDUCATION", "CREDENTIAL"]
};

function yearsRequirement(text: string) {
  const match = text.match(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\b/i);
  return match ? Number(match[1]) : null;
}

function yearsEvidence(evidence: CareerEvidence) {
  const numeric = evidence.metadata?.yearsExperience;
  if (typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0) return numeric;
  const match = evidence.text.match(/\b(\d{1,2})\+\s*years?\b/i);
  return match ? Number(match[1]) : null;
}

export function evidenceRelevance(requirement: ExtractedRequirement, evidence: CareerEvidence) {
  if (!compatibleEvidence[requirement.category].includes(evidence.type)) return 0;
  const requirementTokens = tokenizeAnalysisText(requirement.normalizedText);
  const evidenceTokens = new Set(tokenizeAnalysisText(`${evidence.label} ${evidence.text}`));
  if (!requirementTokens.length) return 0;
  const overlap = requirementTokens.filter((token) => evidenceTokens.has(token));
  const coverage = overlap.length / requirementTokens.length;
  let score = Math.round(coverage * 70);
  const normalizedRequirement = normalizeAnalysisText(requirement.normalizedText).toLowerCase();
  const normalizedLabel = normalizeAnalysisText(evidence.label).toLowerCase();
  if (normalizedLabel.length >= 3 && normalizedRequirement.includes(normalizedLabel)) score += 35;
  if (evidence.type === compatibleEvidence[requirement.category][0]) score += 12;
  if (overlap.length >= 2) score += 8;

  const requirementConcepts = new Set(detectNormalizedConcepts(requirement.originalText));
  if (requirement.normalizedConcept) requirementConcepts.add(requirement.normalizedConcept);
  const evidenceConcepts = detectNormalizedConcepts(`${evidence.label} ${evidence.text}`);
  if ([...requirementConcepts].some((concept) => evidenceConcepts.includes(concept))) score += 40;
  else if ([...requirementConcepts].some((concept) => evidenceConcepts.some((evidenceConcept) => relatedConcepts(concept).includes(evidenceConcept)))) {
    score = Math.min(61, Math.max(score, 45));
  }

  const requestedYears = yearsRequirement(requirement.originalText);
  const supportedYears = yearsEvidence(evidence);
  if (requestedYears !== null && supportedYears !== null) {
    score = supportedYears >= requestedYears ? Math.max(score, 92) : Math.max(score, Math.round((supportedYears / requestedYears) * 55));
  }

  if (requirement.category === "CERTIFICATION" && evidence.type === "CREDENTIAL") {
    const status = evidence.metadata?.credentialStatus;
    const asksForHeldCredential = /\b(required|active|licensed|certified|must (?:hold|have))\b/i.test(requirement.originalText);
    if (status === "CANDIDATE" && asksForHeldCredential) score = Math.min(score, 55);
  }
  if (evidence.metadata?.authorityStatus === "SUPPLEMENTAL") score = Math.min(score, 61);
  return Math.min(100, score);
}

export function matchStateForScore(score: number): Exclude<RequirementMatchState, "UNVERIFIED" | "NOT_APPLICABLE"> {
  if (score >= 82) return "STRONG_MATCH";
  if (score >= 62) return "MATCH";
  if (score >= 30) return "PARTIAL_MATCH";
  return "NO_MATCH";
}

export function isClosedWorldRequirement(requirement: ExtractedRequirement) {
  if (["CERTIFICATION", "EDUCATION", "TECHNOLOGY", "SYSTEM"].includes(requirement.category)) return true;
  if (isClosedWorldConcept(requirement.normalizedConcept)) return true;
  if (detectNormalizedConcepts(requirement.originalText).some((concept) => isClosedWorldConcept(concept))) return true;
  if (yearsRequirement(requirement.originalText) !== null) return true;
  return false;
}

export function isMaterialRequirement(requirement: ExtractedRequirement) {
  if (requirement.importance !== "REQUIRED") return false;
  if (["CERTIFICATION", "EDUCATION"].includes(requirement.category)) return true;
  if (yearsRequirement(requirement.originalText) !== null) return true;
  if (["TECHNOLOGY", "SYSTEM"].includes(requirement.category) && requirement.normalizedConcept) return true;
  if (isClosedWorldConcept(requirement.normalizedConcept)) return true;
  return /\b(clearance|must (?:hold|have)|active license)\b/i.test(requirement.originalText);
}

function unresolvedState(requirement: ExtractedRequirement): "NO_MATCH" | "UNVERIFIED" {
  return isClosedWorldRequirement(requirement) ? "NO_MATCH" : "UNVERIFIED";
}

function gapReasonFor(requirement: ExtractedRequirement, state: RequirementMatchState, bestScore: number): RequirementGapReason | null {
  if (state === "UNVERIFIED") return "UNVERIFIABLE";
  if (state === "PARTIAL_MATCH" && requirement.category === "CERTIFICATION" && /\b(required|active|licensed|certified|must (?:hold|have))\b/i.test(requirement.originalText)) return "CERTIFICATION_NOT_HELD";
  if (state !== "NO_MATCH") return null;
  if (requirement.category === "CERTIFICATION") return "CERTIFICATION_NOT_HELD";
  if (requirement.category === "TECHNOLOGY" || requirement.category === "SYSTEM") return "TECHNOLOGY_ABSENT";
  if (requirement.category === "INDUSTRY") return "INDUSTRY_EXPERIENCE_ABSENT";
  if (requirement.category === "EDUCATION") return "EDUCATION_MISMATCH";
  const requestedYears = yearsRequirement(requirement.originalText);
  if (requestedYears !== null && bestScore > 0 && bestScore < 30) return "YEARS_INSUFFICIENT";
  if (bestScore > 0) return "INSUFFICIENT_EVIDENCE";
  return "UNVERIFIABLE";
}

function explanationFor(requirement: ExtractedRequirement, state: RequirementMatchState, evidence: RequirementEvidenceMatch[], gapReason: RequirementGapReason | null) {
  if (state === "NOT_APPLICABLE") return "This item is excluded from scoring because it is not a career-qualification requirement.";
  if (state === "UNVERIFIED") return "The Master Career Profile does not contain enough information to verify this requirement. That is not treated as proof it is missing.";
  if (state === "NO_MATCH") {
    if (gapReason === "CERTIFICATION_NOT_HELD") return "No held credential in the Master Career Profile satisfies this certification requirement.";
    if (gapReason === "TECHNOLOGY_ABSENT") return "The required technology or system is not present in authoritative career evidence.";
    if (gapReason === "INDUSTRY_EXPERIENCE_ABSENT") return "Authoritative career records do not establish the required industry experience.";
    if (gapReason === "EDUCATION_MISMATCH") return "Education records in the Master Career Profile do not satisfy this requirement.";
    if (gapReason === "YEARS_INSUFFICIENT") return "Authoritative experience exists but does not meet the stated years-of-experience requirement.";
    return "No authoritative Master Career Profile evidence supports this requirement.";
  }
  if (state === "PARTIAL_MATCH" && gapReason === "CERTIFICATION_NOT_HELD") return `Candidate status is verified, but it does not establish the active credential required: ${evidence[0]?.evidence.label}.`;
  if (state === "PARTIAL_MATCH") return `Related evidence exists, but it does not fully establish the requirement: ${evidence[0]?.evidence.label}.`;
  if (state === "MATCH") return `Authoritative evidence supports this requirement through ${evidence[0]?.evidence.label}.`;
  return `Direct authoritative evidence strongly supports this requirement through ${evidence[0]?.evidence.label}.`;
}

function explanationFromHint(hint: RankingHint | undefined, evidence: CareerEvidence) {
  const text = hint?.explanation?.trim() ?? "";
  if (text.length < 3 || text.length > 1000) return null;
  const claimedNumbers = text.match(/\d[\d,]*/g) ?? [];
  const evidenceText = `${evidence.label} ${evidence.text}`;
  if (claimedNumbers.some((value) => value.length > 1 && !evidenceText.includes(value.replaceAll(",", "")))) return null;
  return text;
}

function applyHintBoost(deterministicScore: number, hint: RankingHint | undefined) {
  if (!hint || deterministicScore < 30) return deterministicScore;
  const bounded = Math.max(0, Math.min(100, Math.round(hint.relevance)));
  return Math.min(100, Math.max(deterministicScore, Math.min(deterministicScore + 8, bounded)));
}

export function matchRequirements(
  requirements: ExtractedRequirement[],
  careerEvidence: CareerEvidence[],
  rankingHints: RankingHint[][] = []
) {
  if (!careerEvidence.length) throw new JobAnalysisInputError("CAREER_PROFILE_UNAVAILABLE", "The Master Career Profile is unavailable.");
  return requirements.map<MatchedRequirement>((requirement, index) => {
    if (hardNotApplicablePattern.test(requirement.originalText) || (notApplicablePattern.test(requirement.originalText) && !responsibilityPattern.test(requirement.originalText) && !educationPattern.test(requirement.originalText) && !certificationPattern.test(requirement.originalText) && !technologyPattern.test(requirement.originalText) && !accountingPattern.test(requirement.originalText))) {
      return {
        ...requirement,
        matchState: "NOT_APPLICABLE",
        matchConfidence: 100,
        scoringWeight: 1,
        scoreContribution: 0,
        explanation: explanationFor(requirement, "NOT_APPLICABLE", [], null),
        gapReason: null,
        isMaterial: false,
        evidence: []
      };
    }

    const hints = sanitizeRankingHints(rankingHints[index] ?? [], careerEvidence);
    const ranked = careerEvidence
      .map((evidence) => {
        const hint = hints.find((item) => item.evidenceId === evidence.id);
        return {
          evidence,
          relevanceScore: applyHintBoost(evidenceRelevance(requirement, evidence), hint),
          hint
        };
      })
      .filter((item) => item.relevanceScore >= 30)
      .sort((left, right) => right.relevanceScore - left.relevanceScore || left.evidence.label.localeCompare(right.evidence.label));
    const topScore = ranked[0]?.relevanceScore ?? 0;
    const matchState = topScore >= 30 ? matchStateForScore(topScore) : unresolvedState(requirement);
    const gapReason = gapReasonFor(requirement, matchState, topScore);
    const evidence = matchState === "NO_MATCH" || matchState === "UNVERIFIED"
      ? []
      : ranked.slice(0, 4).map((item) => {
        const overlap = tokenizeAnalysisText(requirement.originalText).filter((token) => tokenizeAnalysisText(`${item.evidence.label} ${item.evidence.text}`).includes(token));
        return {
          evidence: item.evidence,
          relevanceScore: item.relevanceScore,
          explanation: explanationFromHint(item.hint, item.evidence)
            ?? `${item.evidence.label} shares verified requirement concepts (${overlap.join(", ") || "related evidence"}).`
        };
      });
    const scoringWeight = IMPORTANCE_WEIGHTS[requirement.importance];
    return {
      ...requirement,
      matchState,
      matchConfidence: matchState === "NO_MATCH" || matchState === "UNVERIFIED" ? Math.max(65, 100 - topScore) : topScore,
      scoringWeight,
      scoreContribution: UNSCORED_STATES.includes(matchState) ? 0 : scoringWeight * MATCH_STATE_VALUES[matchState],
      explanation: explanationFor(requirement, matchState, evidence, gapReason),
      gapReason,
      isMaterial: isMaterialRequirement(requirement),
      evidence
    };
  });
}

export function calculateOverallMatch(requirements: MatchedRequirement[]) {
  const scored = requirements.filter((requirement) => !UNSCORED_STATES.includes(requirement.matchState));
  const possible = scored.reduce((total, requirement) => total + requirement.scoringWeight, 0);
  if (!possible) return 0;
  const earned = scored.reduce((total, requirement) => total + requirement.scoreContribution, 0);
  return Math.max(0, Math.min(100, Math.round((earned / possible) * 100)));
}

function sliceFor(requirements: MatchedRequirement[]): ScoreSlice {
  const earnedPoints = Number(requirements.reduce((total, requirement) => total + requirement.scoreContribution, 0).toFixed(4));
  const possiblePoints = requirements.reduce((total, requirement) => total + requirement.scoringWeight, 0);
  return {
    count: requirements.length,
    earnedPoints,
    possiblePoints,
    score: possiblePoints ? Math.max(0, Math.min(100, Math.round((earnedPoints / possiblePoints) * 100))) : null
  };
}

export function buildScoreBreakdown(requirements: MatchedRequirement[]): ScoreBreakdown {
  const scored = requirements.filter((requirement) => !UNSCORED_STATES.includes(requirement.matchState));
  const overallScore = calculateOverallMatch(requirements);
  const earnedPoints = Number(scored.reduce((total, requirement) => total + requirement.scoreContribution, 0).toFixed(4));
  const possiblePoints = scored.reduce((total, requirement) => total + requirement.scoringWeight, 0);
  const byImportance = {
    REQUIRED: sliceFor(scored.filter((item) => item.importance === "REQUIRED")),
    PREFERRED: sliceFor(scored.filter((item) => item.importance === "PREFERRED")),
    RESPONSIBILITY: sliceFor(scored.filter((item) => item.importance === "RESPONSIBILITY")),
    CONTEXT: sliceFor(scored.filter((item) => item.importance === "CONTEXT"))
  };
  const byCategory: ScoreBreakdown["byCategory"] = {};
  for (const requirement of scored) {
    byCategory[requirement.category] = sliceFor(scored.filter((item) => item.category === requirement.category));
  }
  const byState = { STRONG_MATCH: 0, MATCH: 0, PARTIAL_MATCH: 0, NO_MATCH: 0, UNVERIFIED: 0, NOT_APPLICABLE: 0 } as Record<RequirementMatchState, number>;
  for (const requirement of requirements) byState[requirement.matchState] += 1;
  const required = byImportance.REQUIRED;
  const preferred = byImportance.PREFERRED;
  const responsibilities = byImportance.RESPONSIBILITY;
  const unverifiedCount = byState.UNVERIFIED;
  const explanation = possiblePoints
    ? `Overall match is ${overallScore}% because ${earnedPoints} of ${possiblePoints} weighted points were earned from verifiable requirements. Required qualifications use weight ${IMPORTANCE_WEIGHTS.REQUIRED} and earned ${required.earnedPoints}/${required.possiblePoints || 0}. Responsibilities use weight ${IMPORTANCE_WEIGHTS.RESPONSIBILITY} and earned ${responsibilities.earnedPoints}/${responsibilities.possiblePoints || 0}. Preferred qualifications use weight ${IMPORTANCE_WEIGHTS.PREFERRED} and earned ${preferred.earnedPoints}/${preferred.possiblePoints || 0}. Strong match counts as 100% of a requirement's weight, match 80%, partial 45%, and a verified gap 0%. ${unverifiedCount} unverified requirement${unverifiedCount === 1 ? "" : "s"} ${unverifiedCount === 1 ? "was" : "were"} excluded from the percentage.`
    : "No scorable requirements were present.";
  return {
    model: SCORING_MODEL_ID,
    overallScore,
    earnedPoints,
    possiblePoints,
    unverifiedCount,
    weights: IMPORTANCE_WEIGHTS,
    values: MATCH_STATE_VALUES,
    byImportance,
    byCategory,
    byState,
    explanation
  };
}

function uniqueLimited(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function buildCareerMatchInsights(requirements: MatchedRequirement[]) {
  const positive = requirements
    .filter((item) => item.matchState === "STRONG_MATCH" || item.matchState === "MATCH")
    .sort((left, right) => right.matchConfidence - left.matchConfidence);
  const missing = requirements
    .filter((item) => item.matchState === "NO_MATCH" || item.matchState === "UNVERIFIED" || (item.isMaterial && item.matchState === "PARTIAL_MATCH"));
  const whyYouMatch = uniqueLimited(positive.map((item) => {
    const labels = uniqueLimited(item.evidence.map((match) => match.evidence.label), 3);
    return labels.length ? `${item.originalText} — supported by ${labels.join(", ")}.` : item.originalText;
  }), 6);
  const whereYouDont = uniqueLimited(missing.map((item) => `${item.originalText} — ${item.explanation}`), 6);
  const resumeUnderselling = uniqueLimited(positive.flatMap((item) => item.evidence
    .filter((match) => match.relevanceScore >= 62 && ["PROJECT", "ACCOMPLISHMENT", "METRIC"].includes(match.evidence.type))
    .map((match) => `${match.evidence.label}: ${match.evidence.text}`)), 5);
  const supportedCategories = uniqueLimited(positive.map((item) => item.category.toLowerCase().replaceAll("_", " ")), 4);
  const strategy: string[] = [];
  if (positive[0]?.evidence[0]) strategy.push(`Lead with ${positive[0].evidence[0].evidence.label} because it directly supports a high-value requirement.`);
  if (supportedCategories.length) strategy.push(`Prioritize verified ${supportedCategories.join(", ")} evidence and mirror the job's exact terminology only where the Master Career Profile supports it.`);
  if (resumeUnderselling.length) strategy.push("Elevate the strongest authoritative project, accomplishment, and metric evidence; keep every number tied to its persisted career record.");
  if (missing.length) strategy.push("Do not claim unsupported qualifications. Address material gaps truthfully and distinguish an unknown from a verified absence.");
  if (!strategy.length) strategy.push("Use only confirmed Master Career Profile evidence and preserve the job description's distinction between required, preferred, responsibility, and context items.");
  return {
    whyYouMatch,
    whereYouDont,
    resumeUnderselling,
    recommendedResumeStrategy: uniqueLimited(strategy, 5)
  };
}

function detectSeniority(title: string, description: string) {
  const value = `${title} ${description.slice(0, 1000)}`;
  if (/\b(chief|cfo|vice president|\bvp\b|executive)\b/i.test(value)) return "EXECUTIVE";
  if (/\bdirector\b/i.test(value)) return "DIRECTOR";
  if (/\bsenior manager\b/i.test(value)) return "SENIOR_MANAGER";
  if (/\bmanager\b/i.test(value)) return "MANAGER";
  if (/\bsenior|\bsr\.?\b|lead\b/i.test(value)) return "SENIOR_INDIVIDUAL_CONTRIBUTOR";
  return "UNSPECIFIED";
}

export function analyzeJobDescription(
  job: JobAnalysisInput,
  careerEvidence: CareerEvidence[],
  rankingHints: RankingHint[][] = [],
  extractedRequirements?: ExtractedRequirement[]
): JobAnalysisResult {
  const requirements = matchRequirements(extractedRequirements ?? extractJobRequirements(job.description), careerEvidence, rankingHints);
  const scoreBreakdown = buildScoreBreakdown(requirements);
  const strongest = requirements
    .filter((item) => item.matchState === "STRONG_MATCH" || item.matchState === "MATCH")
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 5);
  const gaps = requirements.filter((item) => item.matchState === "NO_MATCH").slice(0, 8);
  const materialGaps = requirements.filter((item) => item.isMaterial && (item.matchState === "NO_MATCH" || item.matchState === "UNVERIFIED" || item.matchState === "PARTIAL_MATCH"));
  const insights = buildCareerMatchInsights(requirements);
  return {
    requirements,
    overallScore: scoreBreakdown.overallScore,
    scoreBreakdown,
    summary: {
      requirementCount: requirements.length,
      requiredCount: requirements.filter((item) => item.importance === "REQUIRED").length,
      preferredCount: requirements.filter((item) => item.importance === "PREFERRED").length,
      responsibilityCount: requirements.filter((item) => item.importance === "RESPONSIBILITY").length,
      strongMatchCount: requirements.filter((item) => item.matchState === "STRONG_MATCH").length,
      matchCount: requirements.filter((item) => item.matchState === "MATCH").length,
      partialMatchCount: requirements.filter((item) => item.matchState === "PARTIAL_MATCH").length,
      gapCount: requirements.filter((item) => item.matchState === "NO_MATCH").length,
      unverifiedCount: requirements.filter((item) => item.matchState === "UNVERIFIED").length,
      notApplicableCount: requirements.filter((item) => item.matchState === "NOT_APPLICABLE").length,
      materialGapCount: materialGaps.length,
      strongestAreas: strongest.map((item) => item.originalText),
      gaps: gaps.map((item) => item.originalText),
      materialGaps: materialGaps.map((item) => item.originalText),
      scoreExplanation: scoreBreakdown.explanation,
      ...insights
    },
    jobSnapshot: { title: job.title, employer: job.employer, location: job.location, seniority: detectSeniority(job.title, job.description) }
  };
}

export function analysisIsStale(storedFingerprint: string, currentValue: string) {
  return storedFingerprint !== fingerprint(currentValue);
}

export function matchClassification(score: number) {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good match";
  if (score >= 50) return "Mixed match";
  return "Weak match";
}

export const extractedRequirementSchema = z.object({
  sequenceNumber: z.number().int().min(1).max(200),
  importance: z.enum(["REQUIRED", "PREFERRED", "RESPONSIBILITY", "CONTEXT"]),
  category: z.enum(["RESPONSIBILITY", "SKILL", "TECHNOLOGY", "SYSTEM", "ACCOUNTING", "FINANCE", "DATA", "EDUCATION", "CERTIFICATION", "EXPERIENCE", "LEADERSHIP", "INDUSTRY", "OTHER"]),
  originalText: z.string().trim().min(3).max(2000),
  normalizedText: z.string().trim().min(3).max(2000),
  normalizedConcept: z.string().trim().min(2).max(80).nullable()
});

export function validateExtractedRequirements(value: unknown): ExtractedRequirement[] {
  const parsed = z.array(extractedRequirementSchema).min(2).max(80).safeParse(value);
  if (!parsed.success) throw new JobAnalysisInputError("INVALID_EXTRACTION", "The extracted requirements were not valid structured records.");
  return parsed.data;
}

export function sanitizeRankingHints(hints: RankingHint[], evidence: CareerEvidence[]) {
  const known = new Set(evidence.map((item) => item.id));
  return hints.filter((hint) => known.has(hint.evidenceId) && Number.isFinite(hint.relevance) && hint.relevance >= 0 && hint.relevance <= 100);
}
