import type { CareerFacts } from "@/lib/resumes/career";
import { TargetResumeError } from "@/lib/resumes/target/generate";
import { targetResumeContentSchema, type TargetRequirement, type TargetResumeContent } from "@/lib/resumes/target/types";

const commonWords = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "through", "to", "with", "using", "led", "built", "managed", "delivered", "improved", "reduced"]);

function words(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").split(/\s+/).filter((item) => item.length > 2 && !commonWords.has(item));
}

function numberTokens(text: string) {
  return [...text.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|million|billion|thousand|[kmb]\+?))?/gi)].map((match) => match[0].toLowerCase().replace(/[\s,$]/g, ""));
}

function comparableNumber(token: string) {
  return token.replace("percent", "%").replace("million", "m").replace("billion", "b").replace("thousand", "k");
}

function deniedTerms(career: CareerFacts, requirements: TargetRequirement[], confirmations: Array<{ requirementId: string; answer: "YES" | "NO" }>) {
  const careerText = [...career.factsByKey.values()].map((item) => item.text.toLowerCase()).join(" ");
  const denied = new Set(confirmations.filter((item) => item.answer === "NO").map((item) => item.requirementId));
  return requirements
    .filter((item) => denied.has(item.id) && (item.matchState === "NO_MATCH" || item.matchState === "UNVERIFIED"))
    .flatMap((item) => item.originalText.toLowerCase().match(/\b[a-z][a-z0-9+#.]{3,}\b/g) ?? [])
    .filter((term) => !commonWords.has(term) && term.length >= 6 && !careerText.includes(term))
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, 40);
}

export function validateTargetResume(
  contentInput: unknown,
  career: CareerFacts,
  job: { title: string; employer: string },
  requirements: TargetRequirement[],
  confirmations: Array<{ requirementId: string; answer: "YES" | "NO"; promptText: string }>
): TargetResumeContent {
  const content = targetResumeContentSchema.parse(contentInput);
  const errors: string[] = [];
  if (content.candidate.fullName !== career.profile.fullName || content.candidate.headline !== career.profile.headline || content.candidate.location !== career.profile.location) {
    errors.push("Candidate identity must match the Career Profile.");
  }
  if (content.target.jobTitle !== job.title || content.target.employer !== job.employer) errors.push("Target role must match the job description you dropped in.");

  const organizationById = new Map(career.organizations.map((item) => [item.id, item.name]));
  const titleById = new Map(career.titles.map((item) => [item.id, item.name]));
  const experienceById = new Map(career.experiences.map((item) => [item.id, item]));
  for (const rendered of content.experiences) {
    const fact = experienceById.get(rendered.experienceId);
    if (!fact) { errors.push("Resume includes an unknown employment record."); continue; }
    const employer = organizationById.get(fact.organizationId);
    const client = fact.clientOrganizationId ? organizationById.get(fact.clientOrganizationId) ?? null : null;
    const title = fact.titleId ? titleById.get(fact.titleId) ?? null : null;
    if (rendered.employer !== employer || rendered.client !== client || rendered.title !== title || rendered.startDate !== fact.startDate || rendered.startPrecision !== fact.startPrecision || rendered.endDate !== fact.endDate || rendered.endPrecision !== fact.endPrecision || rendered.isCurrent !== fact.isCurrent || rendered.location !== fact.location) {
      errors.push(`Employment facts changed for ${employer ?? rendered.employer}.`);
    }
    const allowed = new Set(career.accomplishments.filter((item) => item.experienceId === fact.id).map((item) => item.statement));
    if (fact.summary) allowed.add(fact.summary);
    for (const bullet of rendered.bullets) if (!allowed.has(bullet)) errors.push(`Experience language is not grounded to the Career Profile: ${bullet.slice(0, 80)}`);
  }

  const educationById = new Map(career.education.map((item) => [item.id, item]));
  for (const item of content.education) {
    const fact = educationById.get(item.educationId);
    if (!fact || item.degree !== fact.degree || item.fieldOfStudy !== fact.fieldOfStudy || item.institution !== fact.institution || item.completedOn !== fact.completedOn) {
      errors.push("Education must match the Career Profile exactly.");
    }
  }
  const educationIds = content.education.map((item) => item.educationId);
  if (new Set(educationIds).size !== educationIds.length || content.education.length !== career.education.length || career.education.some((item) => !educationIds.includes(item.id))) {
    errors.push("Authoritative education records cannot be omitted, duplicated, or added.");
  }

  const credentialById = new Map(career.credentials.map((item) => [item.id, item]));
  for (const item of content.credentials) {
    const fact = credentialById.get(item.credentialId);
    if (!fact || item.name !== fact.name || item.status !== fact.status) errors.push("Credential status must match the Career Profile exactly.");
  }
  const credentialIds = content.credentials.map((item) => item.credentialId);
  if (new Set(credentialIds).size !== credentialIds.length || content.credentials.length !== career.credentials.length || career.credentials.some((item) => !credentialIds.includes(item.id))) {
    errors.push("Authoritative credentials cannot be omitted, duplicated, or added.");
  }

  const skillById = new Map(career.skills.map((item) => [item.id, item]));
  for (const group of content.skillGroups) {
    for (const skill of group.skills) {
      const fact = skillById.get(skill.skillId);
      if (!fact || fact.name !== skill.name || fact.category !== group.category) errors.push(`Unsupported or misclassified skill: ${skill.name}.`);
    }
  }

  const projectById = new Map(career.projects.map((item) => [item.id, item]));
  for (const project of content.projects) {
    const fact = projectById.get(project.projectId);
    if (!fact || fact.name !== project.name) errors.push(`Unsupported project: ${project.name}.`);
    const allowed = new Set(compactAllowed([fact?.summary, fact?.impact]));
    for (const bullet of project.bullets) if (!allowed.has(bullet)) errors.push(`Project language is not grounded to the Career Profile: ${bullet.slice(0, 80)}`);
  }

  const confirmationById = new Map(confirmations.map((item) => [item.requirementId, item]));
  for (const capability of content.confirmedCapabilities) {
    const confirmation = confirmationById.get(capability.requirementId);
    if (!confirmation || confirmation.answer !== "YES" || confirmation.promptText.trim() !== capability.statement.trim()) {
      errors.push("Confirmed capability statements must match the owner prompt exactly.");
    }
  }

  const groundedPool = [
    career.profile.headline,
    career.profile.summary,
    job.title,
    job.employer,
    ...[...career.factsByKey.values()].map((item) => item.text),
    ...confirmations.filter((item) => item.answer === "YES").map((item) => item.promptText)
  ].join(" ");
  const sourceWords = new Set(words(groundedPool));
  const allowedNumbers = new Set(numberTokens(groundedPool).map(comparableNumber));
  for (const block of [content.thesis, content.summary, ...content.highlights.map((item) => item.text)]) {
    const blockWords = words(block);
    const overlap = blockWords.length ? blockWords.filter((word) => sourceWords.has(word)).length / blockWords.length : 0;
    if (overlap < 0.25) errors.push("Narrative language is not grounded in confirmed experience.");
    for (const token of numberTokens(block).map(comparableNumber)) if (!allowedNumbers.has(token)) errors.push(`Unverified numeric claim ${token}.`);
  }

  const claimed = [content.thesis, content.summary, ...content.highlights.map((item) => item.text), ...content.confirmedCapabilities.map((item) => item.statement)].join(" ");
  for (const term of deniedTerms(career, requirements, confirmations)) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(claimed)) {
      errors.push(`Denied requirement cannot be added as experience: ${term}.`);
    }
  }

  if (errors.length) throw new TargetResumeError("RESUME_FACT_VALIDATION_FAILED", errors[0] ?? "The targeted resume could not be validated.");
  return content;
}

function compactAllowed(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.replace(/\s+/g, " ").trim()).filter((part): part is string => Boolean(part && part.length >= 2));
}
