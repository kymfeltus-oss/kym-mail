import type { ResumeGenerationInput, ResumeGenerationProvider } from "@/domain/providers/resume-generation-provider";
import { resumeContentSchema, type EvidenceRef, type ResumeContent } from "@/lib/resumes/types";

function ref(type: EvidenceRef["type"], id: string): EvidenceRef { return { type, id }; }

export function mergeScopedRegeneration(generated: ResumeContent, prior: ResumeContent | undefined, scope: ResumeGenerationInput["scope"]) {
  if (!prior || !scope || scope.type === "ENTIRE") return resumeContentSchema.parse(generated);
  if (scope.type === "SUMMARY") {
    return resumeContentSchema.parse({ ...prior, candidate: generated.candidate, target: generated.target, summary: generated.summary });
  }
  const replacement = [...generated.experiences.flatMap((item) => item.bullets), ...generated.projects.flatMap((item) => item.bullets)].find((item) => item.key === scope.contentKey);
  if (!replacement) return resumeContentSchema.parse(prior);
  return resumeContentSchema.parse({
    ...prior,
    candidate: generated.candidate,
    target: generated.target,
    experiences: prior.experiences.map((experience) => ({ ...experience, bullets: experience.bullets.map((bullet) => bullet.key === replacement.key ? replacement : bullet) })),
    projects: prior.projects.map((project) => ({ ...project, bullets: project.bullets.map((bullet) => bullet.key === replacement.key ? replacement : bullet) }))
  });
}

export class DeterministicResumeGenerationProvider implements ResumeGenerationProvider {
  readonly key = "deterministic-gate8-v1";
  readonly mode = "DETERMINISTIC" as const;

  async generate(input: ResumeGenerationInput): Promise<ResumeContent> {
    const { career, plan, job } = input;
    const organizations = new Map(career.organizations.map((item) => [item.id, item.name]));
    const titles = new Map(career.titles.map((item) => [item.id, item.name]));
    const accomplishmentById = new Map(career.accomplishments.map((item) => [item.id, item]));
    const metricsByAccomplishment = new Map<string, typeof career.metrics>();
    for (const metric of career.metrics) metricsByAccomplishment.set(metric.accomplishmentId, [...(metricsByAccomplishment.get(metric.accomplishmentId) ?? []), metric]);
    const experiences = plan.experiencePlans.flatMap((experiencePlan) => {
      const experience = career.experiences.find((item) => item.id === experiencePlan.experienceId);
      if (!experience) return [];
      const bullets = experiencePlan.accomplishmentIds.flatMap((id, index) => {
        const accomplishment = accomplishmentById.get(id);
        if (!accomplishment) return [];
        const evidence = [ref("ACCOMPLISHMENT", accomplishment.id), ...(metricsByAccomplishment.get(accomplishment.id) ?? []).map((metric) => ref("METRIC", metric.id))];
        return [{ key: `experience:${experience.id}:bullet:${index + 1}`, text: accomplishment.statement, evidence }];
      });
      if (!bullets.length && experience.summary) bullets.push({ key: `experience:${experience.id}:bullet:1`, text: experience.summary, evidence: [ref("EXPERIENCE", experience.id)] });
      return [{ experienceId: experience.id, employer: organizations.get(experience.organizationId) ?? "Unknown employer", client: experience.clientOrganizationId ? organizations.get(experience.clientOrganizationId) ?? null : null, title: experience.titleId ? titles.get(experience.titleId) ?? null : null, startDate: experience.startDate, startPrecision: experience.startPrecision, endDate: experience.endDate, endPrecision: experience.endPrecision, isCurrent: experience.isCurrent, location: experience.location, bullets }];
    });
    const projects = plan.projectIds.flatMap((id) => {
      const project = career.projects.find((item) => item.id === id);
      if (!project) return [];
      const texts = [project.summary, project.impact].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
      return [{ projectId: project.id, name: project.name, bullets: texts.slice(0, 2).map((text, index) => ({ key: `project:${project.id}:bullet:${index + 1}`, text, evidence: [ref("PROJECT", project.id)] })) }];
    });
    const skillGroups = [...new Set(career.skills.filter((skill) => plan.skillIds.includes(skill.id)).map((skill) => skill.category))].map((category) => ({ category, skills: career.skills.filter((skill) => skill.category === category && plan.skillIds.includes(skill.id)).map((skill) => ({ skillId: skill.id, name: skill.name })) }));
    const content: ResumeContent = {
      candidate: { fullName: career.profile.fullName, headline: career.profile.headline, location: career.profile.location },
      target: { jobTitle: job.title, employer: job.employer },
      summary: { key: "summary:professional", text: career.profile.summary, evidence: [ref("PROFILE", career.profile.ownerId)] },
      experiences,
      projects,
      skillGroups,
      education: career.education.map((item) => ({ educationId: item.id, degree: item.degree, fieldOfStudy: item.fieldOfStudy, institution: item.institution, completedOn: item.completedOn })),
      credentials: career.credentials.map((item) => ({ credentialId: item.id, name: item.name, status: item.status }))
    };
    return mergeScopedRegeneration(content, input.priorContent, input.scope);
  }
}
