import type { CareerFacts } from "@/lib/resumes/career";
import { targetResumeContentSchema, type TargetRequirement, type TargetResumeContent } from "@/lib/resumes/target/types";

export class TargetResumeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TargetResumeError";
  }
}

function compact(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.replace(/\s+/g, " ").trim()).filter((part): part is string => Boolean(part && part.length >= 2));
}

function experienceScore(experienceId: string, career: CareerFacts, matched: TargetRequirement[]) {
  let score = 0;
  for (const requirement of matched) {
    for (const evidence of requirement.matchedEvidence) {
      if (evidence.type === "EXPERIENCE" && evidence.id === experienceId) score += 8;
      if (evidence.type === "ACCOMPLISHMENT") {
        const accomplishment = career.accomplishments.find((item) => item.id === evidence.id);
        if (accomplishment?.experienceId === experienceId) score += 10;
      }
      if (evidence.type === "PROJECT") {
        const project = career.projects.find((item) => item.id === evidence.id);
        if (project?.experienceId === experienceId) score += 6;
      }
    }
  }
  return score;
}

export function generateTargetResume(input: {
  career: CareerFacts;
  title: string;
  employer: string;
  requirements: TargetRequirement[];
  confirmations: Array<{ requirementId: string; answer: "YES" | "NO"; promptText: string }>;
}): TargetResumeContent {
  const { career, title, employer, requirements, confirmations } = input;
  const confirmationByRequirement = new Map(confirmations.map((item) => [item.requirementId, item]));
  const pending = requirements.filter((item) => item.needsConfirmation && !confirmationByRequirement.has(item.id));
  if (pending.length) throw new TargetResumeError("CONFIRMATIONS_REQUIRED", "Confirm whether you have each unmatched requirement before this resume can be written.");

  const matched = requirements.filter((item) => item.matchState === "STRONG_MATCH" || item.matchState === "MATCH");
  const confirmed = requirements.flatMap((requirement) => {
    const confirmation = confirmationByRequirement.get(requirement.id);
    if (!confirmation || confirmation.answer !== "YES") return [];
    return [{ requirement, statement: confirmation.promptText.trim() }];
  });

  const organizations = new Map(career.organizations.map((item) => [item.id, item.name]));
  const titles = new Map(career.titles.map((item) => [item.id, item.name]));
  const relevantProjectIds = new Set(matched.flatMap((item) => item.matchedEvidence.filter((evidence) => evidence.type === "PROJECT").map((evidence) => evidence.id)));

  const experiences = career.experiences
    .filter((item) => item.completeness === "COMPLETE" && item.titleId)
    .sort((left, right) => experienceScore(right.id, career, matched) - experienceScore(left.id, career, matched) || String(right.startDate ?? "").localeCompare(String(left.startDate ?? "")))
    .slice(0, 8)
    .map((experience, index) => {
      const limit = index < 2 ? 4 : index < 5 ? 3 : 2;
      const bullets = career.accomplishments
        .filter((item) => item.experienceId === experience.id)
        .sort((left, right) => {
          const leftHit = matched.some((requirement) => requirement.matchedEvidence.some((evidence) => evidence.id === left.id));
          const rightHit = matched.some((requirement) => requirement.matchedEvidence.some((evidence) => evidence.id === right.id));
          return Number(rightHit) - Number(leftHit);
        })
        .slice(0, limit)
        .map((item) => item.statement);
      if (!bullets.length && experience.summary) bullets.push(experience.summary);
      return {
        experienceId: experience.id,
        employer: organizations.get(experience.organizationId) ?? "Unknown employer",
        client: experience.clientOrganizationId ? organizations.get(experience.clientOrganizationId) ?? null : null,
        title: experience.titleId ? titles.get(experience.titleId) ?? null : null,
        startDate: experience.startDate,
        startPrecision: experience.startPrecision,
        endDate: experience.endDate,
        endPrecision: experience.endPrecision,
        isCurrent: experience.isCurrent,
        location: experience.location,
        bullets
      };
    })
    .filter((item) => item.bullets.length);

  if (!experiences.length) throw new TargetResumeError("CAREER_PROFILE_INCOMPLETE", "Add complete employment records to your Career Profile before a targeted resume can be written.");

  const projects = career.projects
    .filter((item) => relevantProjectIds.has(item.id))
    .slice(0, 4)
    .map((project) => ({
      projectId: project.id,
      name: project.name,
      bullets: compact([project.summary, project.impact]).slice(0, 2)
    }))
    .filter((item) => item.bullets.length);

  const matchedSkillIds = new Set(matched.flatMap((item) => item.matchedEvidence.filter((evidence) => evidence.type === "SKILL").map((evidence) => evidence.id)));
  const orderedSkills = [
    ...career.skills.filter((skill) => matchedSkillIds.has(skill.id)),
    ...career.skills.filter((skill) => !matchedSkillIds.has(skill.id))
  ].slice(0, 24);
  const skillGroups = [...new Set(orderedSkills.map((skill) => skill.category))].map((category) => ({
    category,
    skills: orderedSkills.filter((skill) => skill.category === category).slice(0, 24).map((skill) => ({ skillId: skill.id, name: skill.name }))
  })).filter((group) => group.skills.length);

  const matchedHighlights = matched.slice(0, 4).flatMap((requirement) => {
    const evidence = requirement.matchedEvidence[0];
    if (!evidence) return [];
    return [{ label: requirement.category.replaceAll("_", " ").toLowerCase(), text: evidence.excerpt.slice(0, 800), source: "MATCHED" as const }];
  });
  const confirmedHighlights = confirmed.slice(0, 2).map((item) => ({
    label: "owner confirmed",
    text: item.statement.slice(0, 800),
    source: "CONFIRMED" as const
  }));

  const leadEvidence = matched[0]?.matchedEvidence[0]?.excerpt ?? career.profile.summary;
  const content = {
    candidate: { fullName: career.profile.fullName, headline: career.profile.headline, location: career.profile.location },
    target: { jobTitle: title, employer },
    thesis: `${career.profile.headline} composed for ${employer}'s ${title} brief.`,
    summary: compact([career.profile.summary, leadEvidence === career.profile.summary ? null : leadEvidence]).join(" ")
      .slice(0, 3000),
    highlights: [...matchedHighlights, ...confirmedHighlights].slice(0, 6),
    experiences,
    projects,
    skillGroups,
    education: career.education.map((item) => ({
      educationId: item.id,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy && item.fieldOfStudy.trim().length >= 2 ? item.fieldOfStudy : null,
      institution: item.institution,
      completedOn: item.completedOn
    })),
    credentials: career.credentials.map((item) => ({
      credentialId: item.id,
      name: item.name,
      status: item.status
    })),
    confirmedCapabilities: confirmed.slice(0, 80).map((item) => ({
      requirementId: item.requirement.id,
      requirement: item.requirement.originalText.slice(0, 2000),
      statement: item.statement.slice(0, 2000)
    }))
  };

  const parsed = targetResumeContentSchema.safeParse(content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "content";
    throw new TargetResumeError("RESUME_TARGET_INVALID", `The targeted resume could not be written because ${path} is invalid.`);
  }
  return parsed.data;
}
