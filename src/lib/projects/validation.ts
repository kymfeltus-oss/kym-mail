import { z } from "zod";
import { projectStatuses, projectTypes, type ProjectType } from "@/lib/projects/constants";
export { projectStatuses, projectTypes, projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/constants";

const shortListItem = z.string().trim().min(1).max(100);
const shortList = z.array(shortListItem).min(1).max(20).transform((values) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});
const optionalText = z.string().trim().max(5000).default("");
const requiredContext = z.string().trim().min(2).max(5000);
const base = {
  name: z.string().trim().min(2).max(120),
  objective: z.string().trim().min(2).max(1000),
  defaultMailAccountId: z.string().uuid()
};

export const jobSearchParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetRoles: shortList,
  keywords: shortList,
  locationText: z.string().trim().max(200).default(""),
  arrangements: z.array(z.enum(["REMOTE", "HYBRID", "ONSITE"])).min(1).max(3),
  minimumCompensation: z.number().int().positive().max(10_000_000).nullable(),
  seniority: z.array(z.enum(["MANAGER", "SENIOR_MANAGER", "DIRECTOR", "SENIOR_DIRECTOR", "VP", "C_SUITE"])).min(1).max(6)
});

export const businessOutreachParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetOrganizationNotes: requiredContext,
  targetContactRoles: shortList,
  talkingPoints: optionalText
});

export const partnershipParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetOrganizationContext: requiredContext,
  targetRoles: shortList,
  partnershipContext: requiredContext
});

export const networkingParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetPeopleContext: requiredContext,
  networkingContext: requiredContext
});

export const customParametersSchema = z.object({
  schemaVersion: z.literal(1),
  notes: requiredContext
});

const createSchemas = {
  JOB_SEARCH: z.object({ type: z.literal("JOB_SEARCH"), ...base, parameters: jobSearchParametersSchema }),
  BUSINESS_OUTREACH: z.object({ type: z.literal("BUSINESS_OUTREACH"), ...base, parameters: businessOutreachParametersSchema }),
  PARTNERSHIP: z.object({ type: z.literal("PARTNERSHIP"), ...base, parameters: partnershipParametersSchema }),
  NETWORKING: z.object({ type: z.literal("NETWORKING"), ...base, parameters: networkingParametersSchema }),
  CUSTOM: z.object({ type: z.literal("CUSTOM"), ...base, parameters: customParametersSchema })
} as const;

export type ProjectCreateInput = z.infer<(typeof createSchemas)[ProjectType]>;

export function parseProjectCreateInput(value: unknown): ProjectCreateInput {
  if (!value || typeof value !== "object" || !("type" in value) || !projectTypes.includes((value as { type: ProjectType }).type)) {
    throw new z.ZodError([{ code: "custom", path: ["type"], message: "Select a valid Project type." }]);
  }
  const type = (value as { type: ProjectType }).type;
  return createSchemas[type].parse(value) as ProjectCreateInput;
}

export function parseProjectUpdateInput(type: ProjectType, value: unknown) {
  if (!projectTypes.includes(type)) throw new Error("Unsupported Project type.");
  const parsed = createSchemas[type].omit({ type: true }).parse(value);
  return { ...parsed, type } as ProjectCreateInput;
}

export const projectStatusSchema = z.enum(projectStatuses);

export function splitProjectList(value: string) {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}
