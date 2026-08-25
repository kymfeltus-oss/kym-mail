import { z } from "zod";

export const careerAuthoritySchema = z.enum(["AUTHORITATIVE", "SUPPLEMENTAL", "RESOLVED"]);
export type CareerAuthority = z.infer<typeof careerAuthoritySchema>;

const canonicalKeySchema = z.string().regex(/^[A-Z0-9_]{2,120}$/);
const dateSchema = z.iso.date();
const optionalText = (maximum: number) => z.string().trim().min(2).max(maximum).nullable().default(null);

const sourceSchema = z.object({
  sourceKey: canonicalKeySchema,
  label: z.string().trim().min(2).max(160),
  sourceKind: z.enum(["RESUME", "OWNER_CONFIRMATION"]),
  authorityStatus: careerAuthoritySchema,
  authorityScope: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  reviewedAt: z.iso.datetime({ offset: true }),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  professionalHeadline: z.string().trim().min(2).max(300),
  locationText: optionalText(200),
  professionalSummary: z.string().trim().min(20).max(3000),
  yearsExperienceClaim: z.string().regex(/^[0-9]{1,2}\+$/).nullable().default(null),
  authorityStatus: careerAuthoritySchema,
});

const organizationSchema = z.object({
  canonicalKey: canonicalKeySchema,
  canonicalName: z.string().trim().min(2).max(200),
  organizationKind: z.enum(["EMPLOYER", "CLIENT", "BOTH"]),
  authorityStatus: careerAuthoritySchema,
});

const titleSchema = z.object({
  canonicalKey: canonicalKeySchema,
  canonicalName: z.string().trim().min(2).max(200),
  authorityStatus: careerAuthoritySchema,
});

const experienceSchema = z.object({
  canonicalKey: canonicalKeySchema,
  organizationKey: canonicalKeySchema,
  clientOrganizationKey: canonicalKeySchema.nullable().default(null),
  titleKey: canonicalKeySchema.nullable().default(null),
  startDate: dateSchema.nullable().default(null),
  startPrecision: z.enum(["MONTH", "YEAR", "UNKNOWN"]),
  endDate: dateSchema.nullable().default(null),
  endPrecision: z.enum(["MONTH", "YEAR", "UNKNOWN"]),
  isCurrent: z.boolean().default(false),
  locationText: optionalText(200),
  summary: optionalText(2000),
  completeness: z.enum(["COMPLETE", "PARTIAL"]).default("COMPLETE"),
  authorityStatus: careerAuthoritySchema,
  skillKeys: z.array(canonicalKeySchema).default([]),
});

const educationSchema = z.object({
  canonicalKey: canonicalKeySchema,
  degreeName: z.string().trim().min(2).max(200),
  fieldOfStudy: optionalText(200),
  institutionName: z.string().trim().min(2).max(200),
  completedOn: dateSchema.nullable().default(null),
  authorityStatus: careerAuthoritySchema,
});

const credentialSchema = z.object({
  canonicalKey: canonicalKeySchema,
  credentialName: z.string().trim().min(2).max(200),
  credentialStatus: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "CANDIDATE"]),
  issuingOrganization: optionalText(200),
  authorityStatus: careerAuthoritySchema,
});

const skillSchema = z.object({
  canonicalKey: canonicalKeySchema,
  canonicalName: z.string().trim().min(1).max(160),
  category: z.enum(["FINANCE", "ACCOUNTING", "TECHNOLOGY", "SYSTEM", "DATA", "LEADERSHIP", "INDUSTRY"]),
  authorityStatus: careerAuthoritySchema,
});

const projectSchema = z.object({
  canonicalKey: canonicalKeySchema,
  canonicalName: z.string().trim().min(2).max(200),
  projectKind: z.enum(["APPLICATION", "TECHNICAL_PROJECT"]),
  experienceKey: canonicalKeySchema.nullable().default(null),
  clientOrganizationKey: canonicalKeySchema.nullable().default(null),
  summary: z.string().trim().min(10).max(3000),
  businessChallenge: optionalText(3000),
  architecture: optionalText(3000),
  impact: optionalText(3000),
  authorityStatus: careerAuthoritySchema,
  skillKeys: z.array(canonicalKeySchema).default([]),
});

const accomplishmentSchema = z.object({
  canonicalKey: canonicalKeySchema,
  experienceKey: canonicalKeySchema.nullable().default(null),
  projectKey: canonicalKeySchema.nullable().default(null),
  category: z.enum(["FINANCE", "ACCOUNTING", "AUTOMATION", "CONTROLS", "LEADERSHIP", "REPORTING", "OPERATIONS", "TECHNOLOGY"]),
  statement: z.string().trim().min(10).max(3000),
  authorityStatus: careerAuthoritySchema,
});

const metricSchema = z.object({
  canonicalKey: canonicalKeySchema,
  accomplishmentKey: canonicalKeySchema,
  metricType: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  valueNumeric: z.number().finite().nullable().default(null),
  valueText: z.string().trim().min(1).max(300).nullable().default(null),
  beforeNumeric: z.number().finite().nullable().default(null),
  beforeText: z.string().trim().min(1).max(300).nullable().default(null),
  afterNumeric: z.number().finite().nullable().default(null),
  afterText: z.string().trim().min(1).max(300).nullable().default(null),
  unit: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/).nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null),
  qualifier: z.enum(["EXACT", "MINIMUM", "APPROXIMATE", "UNDER", "REDUCTION", "IMPROVEMENT"]).nullable().default(null),
  scopeText: optionalText(500),
  authorityStatus: careerAuthoritySchema,
});

const entityTypeSchema = z.enum(["PROFILE", "ORGANIZATION", "TITLE", "EXPERIENCE", "EDUCATION", "CREDENTIAL", "SKILL", "PROJECT", "ACCOMPLISHMENT", "METRIC"]);

const aliasSchema = z.object({
  entityType: z.enum(["ORGANIZATION", "TITLE", "SKILL", "PROJECT"]),
  entityKey: canonicalKeySchema,
  aliasText: z.string().trim().min(1).max(200),
});

const provenanceSchema = z.object({
  sourceKey: canonicalKeySchema,
  entityType: entityTypeSchema,
  entityKey: canonicalKeySchema,
  fieldName: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  sourcePage: z.number().int().min(0).max(1000).default(0),
  sourceWording: z.string().trim().min(1).max(5000),
  sourceRole: careerAuthoritySchema,
  resolutionNote: optionalText(2000),
});

const rawCareerIntakeSchema = z.object({
  sources: z.array(sourceSchema).min(1),
  profile: profileSchema,
  organizations: z.array(organizationSchema).min(1),
  titles: z.array(titleSchema),
  experiences: z.array(experienceSchema).min(1),
  education: z.array(educationSchema),
  credentials: z.array(credentialSchema),
  skills: z.array(skillSchema),
  projects: z.array(projectSchema),
  accomplishments: z.array(accomplishmentSchema),
  metrics: z.array(metricSchema),
  aliases: z.array(aliasSchema),
  provenance: z.array(provenanceSchema).min(1),
});

export type CareerIntake = z.infer<typeof rawCareerIntakeSchema>;

const authorityRank: Record<CareerAuthority, number> = {
  SUPPLEMENTAL: 1,
  AUTHORITATIVE: 2,
  RESOLVED: 3,
};

export function assertAuthorityCanReplace(existing: CareerAuthority, incoming: CareerAuthority) {
  if (authorityRank[incoming] < authorityRank[existing]) {
    throw new Error(`Authority downgrade rejected: ${existing} cannot be replaced by ${incoming}`);
  }
}

function assertUniqueKeys<T extends { canonicalKey: string }>(label: string, values: T[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.canonicalKey)) throw new Error(`Duplicate ${label} canonical key: ${value.canonicalKey}`);
    seen.add(value.canonicalKey);
  }
}

function assertReferences(intake: CareerIntake) {
  const sources = new Set(intake.sources.map((value) => value.sourceKey));
  const organizations = new Set(intake.organizations.map((value) => value.canonicalKey));
  const titles = new Set(intake.titles.map((value) => value.canonicalKey));
  const experiences = new Set(intake.experiences.map((value) => value.canonicalKey));
  const education = new Set(intake.education.map((value) => value.canonicalKey));
  const credentials = new Set(intake.credentials.map((value) => value.canonicalKey));
  const skills = new Set(intake.skills.map((value) => value.canonicalKey));
  const projects = new Set(intake.projects.map((value) => value.canonicalKey));
  const accomplishments = new Set(intake.accomplishments.map((value) => value.canonicalKey));
  const metrics = new Set(intake.metrics.map((value) => value.canonicalKey));
  const entityKeys: Record<z.infer<typeof entityTypeSchema>, Set<string>> = {
    PROFILE: new Set(["PROFILE"]), ORGANIZATION: organizations, TITLE: titles, EXPERIENCE: experiences,
    EDUCATION: education, CREDENTIAL: credentials, SKILL: skills, PROJECT: projects,
    ACCOMPLISHMENT: accomplishments, METRIC: metrics,
  };

  for (const experience of intake.experiences) {
    if (!organizations.has(experience.organizationKey)) throw new Error(`Unknown experience organization: ${experience.organizationKey}`);
    if (experience.clientOrganizationKey && !organizations.has(experience.clientOrganizationKey)) throw new Error(`Unknown experience client: ${experience.clientOrganizationKey}`);
    if (experience.titleKey && !titles.has(experience.titleKey)) throw new Error(`Unknown experience title: ${experience.titleKey}`);
    if (experience.completeness === "COMPLETE" && !experience.titleKey) throw new Error(`Complete experience requires a title: ${experience.canonicalKey}`);
    if ((experience.startDate === null) !== (experience.startPrecision === "UNKNOWN")) throw new Error(`Invalid start date precision: ${experience.canonicalKey}`);
    if ((experience.endDate === null) !== (experience.endPrecision === "UNKNOWN")) throw new Error(`Invalid end date precision: ${experience.canonicalKey}`);
    if (experience.isCurrent && experience.endDate) throw new Error(`Current experience cannot have an end date: ${experience.canonicalKey}`);
    if (experience.startDate && experience.endDate && experience.endDate < experience.startDate) throw new Error(`Invalid experience date range: ${experience.canonicalKey}`);
    for (const skillKey of experience.skillKeys) if (!skills.has(skillKey)) throw new Error(`Unknown experience skill: ${skillKey}`);
  }
  for (const project of intake.projects) {
    if (project.experienceKey && !experiences.has(project.experienceKey)) throw new Error(`Unknown project experience: ${project.experienceKey}`);
    if (project.clientOrganizationKey && !organizations.has(project.clientOrganizationKey)) throw new Error(`Unknown project client: ${project.clientOrganizationKey}`);
    for (const skillKey of project.skillKeys) if (!skills.has(skillKey)) throw new Error(`Unknown project skill: ${skillKey}`);
  }
  for (const accomplishment of intake.accomplishments) {
    if (!accomplishment.experienceKey && !accomplishment.projectKey) throw new Error(`Orphaned accomplishment: ${accomplishment.canonicalKey}`);
    if (accomplishment.experienceKey && !experiences.has(accomplishment.experienceKey)) throw new Error(`Unknown accomplishment experience: ${accomplishment.experienceKey}`);
    if (accomplishment.projectKey && !projects.has(accomplishment.projectKey)) throw new Error(`Unknown accomplishment project: ${accomplishment.projectKey}`);
  }
  for (const metric of intake.metrics) {
    if (!accomplishments.has(metric.accomplishmentKey)) throw new Error(`Unknown metric accomplishment: ${metric.accomplishmentKey}`);
    if ([metric.valueNumeric, metric.valueText, metric.beforeNumeric, metric.beforeText, metric.afterNumeric, metric.afterText].every((value) => value === null)) {
      throw new Error(`Metric requires a value: ${metric.canonicalKey}`);
    }
  }
  for (const alias of intake.aliases) if (!entityKeys[alias.entityType].has(alias.entityKey)) throw new Error(`Unknown alias target: ${alias.entityKey}`);
  for (const fact of intake.provenance) {
    if (!sources.has(fact.sourceKey)) throw new Error(`Unknown provenance source: ${fact.sourceKey}`);
    if (!entityKeys[fact.entityType].has(fact.entityKey)) throw new Error(`Unknown provenance target: ${fact.entityType}/${fact.entityKey}`);
  }
}

export function parseCareerIntake(input: unknown): CareerIntake {
  const intake = rawCareerIntakeSchema.parse(input);
  assertUniqueKeys("organization", intake.organizations);
  assertUniqueKeys("title", intake.titles);
  assertUniqueKeys("experience", intake.experiences);
  assertUniqueKeys("education", intake.education);
  assertUniqueKeys("credential", intake.credentials);
  assertUniqueKeys("skill", intake.skills);
  assertUniqueKeys("project", intake.projects);
  assertUniqueKeys("accomplishment", intake.accomplishments);
  assertUniqueKeys("metric", intake.metrics);
  assertReferences(intake);
  return intake;
}
