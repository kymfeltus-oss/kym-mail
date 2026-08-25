import type { CareerFacts } from "@/lib/resumes/career";
import { resumeContentSchema, type ResumeContent } from "@/lib/resumes/types";

export class ResumeValidationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

const commonWords = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "through", "to", "with", "using", "led", "built", "managed", "delivered", "improved", "reduced"]);
function words(text: string) { return text.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").split(/\s+/).filter((item) => item.length > 2 && !commonWords.has(item)); }
function numberTokens(text: string) { return [...text.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|million|billion|thousand|[kmb]\+?))?/gi)].map((match) => match[0].toLowerCase().replace(/[\s,$]/g, "")); }
function comparableNumber(token: string) { return token.replace("percent", "%").replace("million", "m").replace("billion", "b").replace("thousand", "k"); }

function editableBlocks(content: ResumeContent) {
  return [content.summary, ...content.experiences.flatMap((item) => item.bullets), ...content.projects.flatMap((item) => item.bullets)];
}

export function validateResumeContent(contentInput: unknown, career: CareerFacts, job: { title: string; employer: string }, unsupportedTerms: string[] = []) {
  const content = resumeContentSchema.parse(contentInput);
  const errors: string[] = [];
  if (content.candidate.fullName !== career.profile.fullName || content.candidate.headline !== career.profile.headline || content.candidate.location !== career.profile.location) errors.push("Candidate identity must match the Master Career Profile.");
  if (content.target.jobTitle !== job.title || content.target.employer !== job.employer) errors.push("Target job must match the saved opportunity.");
  const organizationById = new Map(career.organizations.map((item) => [item.id, item.name]));
  const titleById = new Map(career.titles.map((item) => [item.id, item.name]));
  const experienceById = new Map(career.experiences.map((item) => [item.id, item]));
  for (const rendered of content.experiences) {
    const fact = experienceById.get(rendered.experienceId);
    if (!fact) { errors.push("Resume includes an unknown employment record."); continue; }
    const employer = organizationById.get(fact.organizationId);
    const client = fact.clientOrganizationId ? organizationById.get(fact.clientOrganizationId) ?? null : null;
    const title = fact.titleId ? titleById.get(fact.titleId) ?? null : null;
    if (rendered.employer !== employer || rendered.client !== client || rendered.title !== title || rendered.startDate !== fact.startDate || rendered.startPrecision !== fact.startPrecision || rendered.endDate !== fact.endDate || rendered.endPrecision !== fact.endPrecision || rendered.isCurrent !== fact.isCurrent) errors.push(`Employment facts changed for ${employer ?? rendered.employer}.`);
  }
  if (new Set(content.experiences.map((item) => item.experienceId)).size !== content.experiences.length) errors.push("Duplicate employment records are not allowed.");

  const educationById = new Map(career.education.map((item) => [item.id, item]));
  for (const item of content.education) {
    const fact = educationById.get(item.educationId);
    if (!fact || item.degree !== fact.degree || item.fieldOfStudy !== fact.fieldOfStudy || item.institution !== fact.institution || item.completedOn !== fact.completedOn) errors.push("Education must match the Master Career Profile exactly.");
  }
  if (content.education.length !== career.education.length) errors.push("Authoritative education records cannot be omitted or added.");
  const credentialById = new Map(career.credentials.map((item) => [item.id, item]));
  for (const item of content.credentials) {
    const fact = credentialById.get(item.credentialId);
    if (!fact || item.name !== fact.name || item.status !== fact.status) errors.push("Credential status must match the Master Career Profile exactly.");
  }
  if (content.credentials.length !== career.credentials.length) errors.push("Authoritative credentials cannot be omitted or added.");
  const skillById = new Map(career.skills.map((item) => [item.id, item]));
  for (const item of content.skillGroups.flatMap((group) => group.skills)) {
    const fact = skillById.get(item.skillId);
    if (!fact || item.name !== fact.name) errors.push(`Unsupported skill: ${item.name}.`);
  }
  const projectById = new Map(career.projects.map((item) => [item.id, item]));
  for (const item of content.projects) {
    const fact = projectById.get(item.projectId);
    if (!fact || item.name !== fact.name) errors.push(`Unsupported project: ${item.name}.`);
  }
  if (new Set(content.projects.map((item) => item.projectId)).size !== content.projects.length) errors.push("A canonical project may appear only once.");

  const allEditableText = editableBlocks(content).map((block) => block.text).join("\n");
  for (const term of unsupportedTerms.filter((item) => item.length >= 3)) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(allEditableText)) errors.push(`Unsupported requirement cannot be added as experience: ${term}.`);
  }
  for (const credential of career.credentials.filter((item) => item.status === "CANDIDATE")) {
    const base = credential.name.replace(/\s+Candidate$/i, "").trim();
    if (base && new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?!\\s+Candidate)`, "i").test(allEditableText)) errors.push(`${base} cannot be represented as completed while the authoritative status is Candidate.`);
  }
  for (const block of editableBlocks(content)) {
    const evidence = block.evidence.map((item) => career.factsByKey.get(`${item.type}:${item.id}`)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (evidence.length !== block.evidence.length) { errors.push(`Evidence is missing for ${block.key}.`); continue; }
    const source = evidence.map((item) => item.text).join(" ");
    const sourceWords = new Set(words(source));
    const blockWords = words(block.text);
    const overlap = blockWords.length ? blockWords.filter((word) => sourceWords.has(word)).length / blockWords.length : 0;
    if (overlap < 0.25) errors.push(`Text is not sufficiently grounded in authoritative evidence: ${block.key}.`);
    const allowedNumbers = new Set(numberTokens(source).map(comparableNumber));
    for (const token of numberTokens(block.text).map(comparableNumber)) if (!allowedNumbers.has(token)) errors.push(`Unverified numeric claim ${token} in ${block.key}.`);
  }
  if (errors.length) throw new ResumeValidationError("RESUME_FACT_VALIDATION_FAILED", errors[0]);
  return { content, summary: { passed: true, checks: ["identity", "employment", "education", "credentials", "skills", "projects", "evidence", "metrics", "unsupported-requirements"], checkedAt: new Date().toISOString() } };
}

