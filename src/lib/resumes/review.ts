import { createHash } from "node:crypto";
import { resumeDiffItemSchema, resumeStrategySchema, type MasterResumeContent, type ResumeContent, type ResumeDiffItem, type ResumeStrategy } from "@/lib/resumes/types";

type AnalysisSummary = {
  strongestAreas?: string[];
  whyYouMatch?: string[];
  whereYouDont?: string[];
  materialGaps?: string[];
  resumeUnderselling?: string[];
  recommendedResumeStrategy?: string[];
};

function boundedStrategyText(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 500) return normalized;
  const clipped = normalized.slice(0, 499);
  const sentenceBreak = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("; "));
  const wordBreak = clipped.lastIndexOf(" ");
  const end = sentenceBreak >= 320 ? sentenceBreak + 1 : wordBreak >= 320 ? wordBreak : 499;
  return `${clipped.slice(0, end).trimEnd()}…`;
}

function unique(items: Array<string | null | undefined>, limit: number) {
  return [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item && item.length >= 2)).map(boundedStrategyText))].slice(0, limit);
}

export function buildResumeStrategy(summary: AnalysisSummary, master: MasterResumeContent, tailored: ResumeContent): ResumeStrategy {
  const tailoredExperienceIds = new Set(tailored.experiences.map((item) => item.experienceId));
  const tailoredSkillIds = new Set(tailored.skillGroups.flatMap((group) => group.skills.map((item) => item.skillId)));
  const reduce = [
    ...master.experiences.filter((item) => !tailoredExperienceIds.has(item.experienceId)).map((item) => `${item.title ?? "Earlier role"} at ${item.employer}`),
    ...master.skillGroups.flatMap((group) => group.skills).filter((item) => !tailoredSkillIds.has(item.skillId)).slice(0, 4).map((item) => item.name)
  ];
  return resumeStrategySchema.parse({
    leadWith: unique([...(summary.whyYouMatch ?? []), ...(summary.strongestAreas ?? [])], 6),
    increaseEmphasis: unique(summary.recommendedResumeStrategy ?? [], 8),
    reduceEmphasis: unique(reduce, 8),
    addVerifiedEvidence: unique(summary.resumeUnderselling ?? [], 8),
    potentialGaps: unique([...(summary.whereYouDont ?? []), ...(summary.materialGaps ?? [])], 8)
  });
}

function evidenceSignature(block: { evidence: Array<{ type: string; id: string }> }) {
  return block.evidence.map((item) => `${item.type}:${item.id}`).sort().join("|");
}

function item(input: Omit<ResumeDiffItem, "key"> & { seed: string }): ResumeDiffItem {
  const key = `change:${createHash("sha256").update(input.seed).digest("hex").slice(0, 24)}`;
  return resumeDiffItemSchema.parse({ key, kind: input.kind, section: input.section, label: input.label, before: input.before, after: input.after, contentKey: input.contentKey });
}

export function buildResumeDiff(master: MasterResumeContent, tailored: ResumeContent): ResumeDiffItem[] {
  const diff: ResumeDiffItem[] = [];
  if (master.summary.text !== tailored.summary.text) diff.push(item({ seed: "summary", kind: "REWRITTEN", section: "SUMMARY", label: "Executive summary", before: master.summary.text, after: tailored.summary.text, contentKey: tailored.summary.key }));
  const masterOrder = master.experiences.map((entry) => entry.experienceId).join(":");
  const tailoredOrder = tailored.experiences.map((entry) => entry.experienceId).join(":");
  if (masterOrder !== tailoredOrder) diff.push(item({ seed: `experience-order:${tailoredOrder}`, kind: "REORDERED", section: "EXPERIENCE", label: "Experience order and emphasis", before: master.experiences.map((entry) => entry.employer).join(" -> "), after: tailored.experiences.map((entry) => entry.employer).join(" -> "), contentKey: "experience:order" }));

  const masterBlocks = new Map(master.experiences.flatMap((entry) => entry.bullets).map((block) => [evidenceSignature(block), block]));
  const tailoredBlocks = tailored.experiences.flatMap((entry) => entry.bullets);
  const tailoredSignatures = new Set(tailoredBlocks.map(evidenceSignature));
  for (const block of tailoredBlocks) {
    const prior = masterBlocks.get(evidenceSignature(block));
    if (!prior) diff.push(item({ seed: `added:${block.key}`, kind: "ADDED", section: "ACCOMPLISHMENTS", label: "Verified accomplishment added", before: null, after: block.text, contentKey: block.key }));
    else if (prior.text !== block.text) diff.push(item({ seed: `rewritten:${block.key}`, kind: "REWRITTEN", section: "ACCOMPLISHMENTS", label: "Accomplishment presentation rewritten", before: prior.text, after: block.text, contentKey: block.key }));
    const hasMetric = block.evidence.some((evidence) => evidence.type === "METRIC");
    if (hasMetric) diff.push(item({ seed: `metric:${block.key}`, kind: "EMPHASIZED", section: "METRICS", label: "Verified metric emphasized", before: prior?.text ?? null, after: block.text, contentKey: block.key }));
  }
  for (const block of master.experiences.flatMap((entry) => entry.bullets)) if (!tailoredSignatures.has(evidenceSignature(block))) diff.push(item({ seed: `removed:${block.key}`, kind: "DEEMPHASIZED", section: "ACCOMPLISHMENTS", label: "Lower-priority accomplishment omitted", before: block.text, after: null, contentKey: block.key }));

  const masterSkills = new Set(master.skillGroups.flatMap((group) => group.skills.map((skill) => skill.skillId)));
  const tailoredSkills = tailored.skillGroups.flatMap((group) => group.skills);
  const removedSkills = master.skillGroups.flatMap((group) => group.skills).filter((skill) => !tailoredSkills.some((candidate) => candidate.skillId === skill.skillId));
  const addedSkills = tailoredSkills.filter((skill) => !masterSkills.has(skill.skillId));
  if (removedSkills.length || addedSkills.length) diff.push(item({ seed: `skills:${tailoredSkills.map((skill) => skill.skillId).join(":")}`, kind: "EMPHASIZED", section: "SKILLS", label: "Role-relevant skills selected", before: removedSkills.length ? `Reduced: ${removedSkills.map((skill) => skill.name).join(", ")}` : null, after: tailoredSkills.map((skill) => skill.name).join(", "), contentKey: "skills:selection" }));

  const masterProjects = new Map(master.projects.map((project) => [project.projectId, project]));
  const tailoredProjectIds = new Set(tailored.projects.map((project) => project.projectId));
  for (const project of tailored.projects) if (!masterProjects.has(project.projectId)) diff.push(item({ seed: `project-added:${project.projectId}`, kind: "ADDED", section: "PROJECTS", label: `Project added: ${project.name}`, before: null, after: project.bullets.map((block) => block.text).join(" "), contentKey: `project:${project.projectId}` }));
  for (const project of master.projects) if (!tailoredProjectIds.has(project.projectId)) diff.push(item({ seed: `project-removed:${project.projectId}`, kind: "DEEMPHASIZED", section: "PROJECTS", label: `Project de-emphasized: ${project.name}`, before: project.bullets.map((block) => block.text).join(" "), after: null, contentKey: `project:${project.projectId}` }));
  return diff.slice(0, 80);
}
