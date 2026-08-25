import { z } from "zod";

export const careerEditableEntitySchema = z.enum([
  "profile", "organization", "title", "experience", "education",
  "credential", "skill", "project", "accomplishment", "metric"
]);
export type CareerEditableEntity = z.infer<typeof careerEditableEntitySchema>;

const nullableText = (minimum: number, maximum: number) => z.union([
  z.string().trim().min(minimum).max(maximum),
  z.literal("").transform(() => null),
  z.null()
]);
const requiredText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const nullableDate = z.union([z.iso.date(), z.literal("").transform(() => null), z.null()]);
const nullableUuid = z.union([z.uuid(), z.literal("").transform(() => null), z.null()]);
const authority = z.literal("RESOLVED").default("RESOLVED");

const profileSchema = z.object({
  full_name: requiredText(2, 120).optional(),
  professional_headline: requiredText(2, 300).optional(),
  location_text: nullableText(2, 200).optional(),
  professional_summary: requiredText(20, 3000).optional(),
  years_experience_claim: z.union([z.string().regex(/^[0-9]{1,2}\+$/), z.literal("").transform(() => null), z.null()]).optional(),
  authority_status: authority
}).strict();

const organizationSchema = z.object({
  canonical_name: requiredText(2, 200).optional(),
  organization_kind: z.enum(["EMPLOYER", "CLIENT", "BOTH"]).optional(),
  authority_status: authority
}).strict();

const titleSchema = z.object({
  canonical_name: requiredText(2, 200).optional(),
  authority_status: authority
}).strict();

const experienceSchema = z.object({
  organization_id: z.uuid().optional(),
  client_organization_id: nullableUuid.optional(),
  title_id: nullableUuid.optional(),
  start_date: nullableDate.optional(),
  start_precision: z.enum(["MONTH", "YEAR", "UNKNOWN"]).optional(),
  end_date: nullableDate.optional(),
  end_precision: z.enum(["MONTH", "YEAR", "UNKNOWN"]).optional(),
  is_current: z.boolean().optional(),
  location_text: nullableText(2, 200).optional(),
  summary: nullableText(2, 2000).optional(),
  completeness: z.enum(["COMPLETE", "PARTIAL"]).optional(),
  authority_status: authority
}).strict();

const educationSchema = z.object({
  degree_name: requiredText(2, 200).optional(),
  field_of_study: nullableText(2, 200).optional(),
  institution_name: requiredText(2, 200).optional(),
  completed_on: nullableDate.optional(),
  authority_status: authority
}).strict();

const credentialSchema = z.object({
  credential_name: requiredText(2, 200).optional(),
  credential_status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "CANDIDATE"]).optional(),
  issuing_organization: nullableText(2, 200).optional(),
  authority_status: authority
}).strict();

const skillSchema = z.object({
  canonical_name: requiredText(1, 160).optional(),
  category: z.enum(["FINANCE", "ACCOUNTING", "TECHNOLOGY", "SYSTEM", "DATA", "LEADERSHIP", "INDUSTRY"]).optional(),
  authority_status: authority
}).strict();

const projectSchema = z.object({
  canonical_name: requiredText(2, 200).optional(),
  experience_id: nullableUuid.optional(),
  client_organization_id: nullableUuid.optional(),
  summary: requiredText(10, 3000).optional(),
  business_challenge: nullableText(5, 3000).optional(),
  architecture: nullableText(5, 3000).optional(),
  impact: nullableText(5, 3000).optional(),
  authority_status: authority
}).strict();

const accomplishmentSchema = z.object({
  experience_id: nullableUuid.optional(),
  project_id: nullableUuid.optional(),
  category: z.enum(["FINANCE", "ACCOUNTING", "AUTOMATION", "CONTROLS", "LEADERSHIP", "REPORTING", "OPERATIONS", "TECHNOLOGY"]).optional(),
  statement: requiredText(10, 3000).optional(),
  authority_status: authority
}).strict();

const nullableNumber = z.union([z.number().finite(), z.null()]);
const metricSchema = z.object({
  accomplishment_id: z.uuid().optional(),
  metric_type: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/).optional(),
  value_numeric: nullableNumber.optional(),
  value_text: nullableText(1, 300).optional(),
  before_numeric: nullableNumber.optional(),
  before_text: nullableText(1, 300).optional(),
  after_numeric: nullableNumber.optional(),
  after_text: nullableText(1, 300).optional(),
  unit: z.union([z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/), z.literal("").transform(() => null), z.null()]).optional(),
  currency: z.union([z.string().regex(/^[A-Z]{3}$/), z.literal("").transform(() => null), z.null()]).optional(),
  qualifier: z.enum(["EXACT", "MINIMUM", "APPROXIMATE", "UNDER", "REDUCTION", "IMPROVEMENT"]).nullable().optional(),
  scope_text: nullableText(2, 500).optional(),
  authority_status: authority
}).strict();

const schemas: Record<CareerEditableEntity, z.ZodType<Record<string, unknown>>> = {
  profile: profileSchema,
  organization: organizationSchema,
  title: titleSchema,
  experience: experienceSchema,
  education: educationSchema,
  credential: credentialSchema,
  skill: skillSchema,
  project: projectSchema,
  accomplishment: accomplishmentSchema,
  metric: metricSchema
};

export const careerTableByEntity: Record<CareerEditableEntity, string> = {
  profile: "career_profiles",
  organization: "career_organizations",
  title: "career_titles",
  experience: "career_experiences",
  education: "career_education",
  credential: "career_credentials",
  skill: "career_skills",
  project: "career_projects",
  accomplishment: "career_accomplishments",
  metric: "career_metrics"
};

export function parseCareerEdit(entity: CareerEditableEntity, input: unknown) {
  const parsed = schemas[entity].parse({ ...(typeof input === "object" && input ? input : {}), authority_status: "RESOLVED" });
  if (Object.keys(parsed).filter((key) => key !== "authority_status").length === 0) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Choose at least one fact to update." }]);
  }
  return parsed;
}
