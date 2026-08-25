import { z } from "zod";
import {
  PROJECT_COMPENSATION_MAX,
  PROJECT_COMPENSATION_MIN,
  projectStatuses,
  projectTypes,
  seniorityLevels,
  workArrangements,
  type ProjectType
} from "@/lib/projects/constants";

export {
  PROJECT_COMPENSATION_MAX,
  PROJECT_COMPENSATION_MIN,
  projectStatuses,
  projectTypes,
  projectStatusLabels,
  projectTypeLabels,
  seniorityLevelLabels,
  seniorityLevels,
  workArrangementLabels,
  workArrangements,
  type ProjectStatus,
  type ProjectType,
  type SeniorityLevel,
  type WorkArrangementPreference
} from "@/lib/projects/constants";

export type ProjectFieldName =
  | "name"
  | "objective"
  | "type"
  | "defaultMailAccountId"
  | "targetRoles"
  | "keywords"
  | "locationText"
  | "arrangements"
  | "minimumCompensation"
  | "seniority"
  | "organizationContext"
  | "talkingPoints"
  | "peopleContext"
  | "networkingContext"
  | "notes";

export type ProjectFieldErrors = Partial<Record<ProjectFieldName, string>>;

const genericSchemaMessage = /^(invalid input|invalid type|invalid uuid|required|too small:|too big:)/i;

const fieldFallbacks: Record<ProjectFieldName, string> = {
  name: "Enter a Project name of at least 2 characters.",
  objective: "Enter an objective of at least 2 characters.",
  type: "Select a valid Project type.",
  defaultMailAccountId: "Select an available default sending identity.",
  targetRoles: "Enter at least one target role.",
  keywords: "Enter at least one keyword or skill.",
  locationText: "Location must be 200 characters or fewer.",
  arrangements: "Select at least one work arrangement.",
  minimumCompensation: `Enter a whole-dollar annual amount between ${PROJECT_COMPENSATION_MIN} and ${PROJECT_COMPENSATION_MAX.toLocaleString("en-US")}, or leave this blank.`,
  seniority: "Select at least one seniority level.",
  organizationContext: "Enter at least 2 characters of organization context.",
  talkingPoints: "Enter at least 2 characters of context.",
  peopleContext: "Enter at least 2 characters of people or role context.",
  networkingContext: "Enter at least 2 characters of networking context.",
  notes: "Enter at least 2 characters of notes or context."
};

const pathToField: Record<string, ProjectFieldName> = {
  name: "name",
  objective: "objective",
  type: "type",
  defaultMailAccountId: "defaultMailAccountId",
  "parameters.targetRoles": "targetRoles",
  "parameters.keywords": "keywords",
  "parameters.locationText": "locationText",
  "parameters.arrangements": "arrangements",
  "parameters.minimumCompensation": "minimumCompensation",
  "parameters.seniority": "seniority",
  "parameters.targetOrganizationNotes": "organizationContext",
  "parameters.targetContactRoles": "targetRoles",
  "parameters.talkingPoints": "talkingPoints",
  "parameters.targetOrganizationContext": "organizationContext",
  "parameters.partnershipContext": "talkingPoints",
  "parameters.targetPeopleContext": "peopleContext",
  "parameters.networkingContext": "networkingContext",
  "parameters.notes": "notes"
};

export const projectFieldFocusOrder: Record<ProjectType, ProjectFieldName[]> = {
  JOB_SEARCH: ["name", "objective", "targetRoles", "keywords", "locationText", "arrangements", "minimumCompensation", "seniority", "defaultMailAccountId"],
  BUSINESS_OUTREACH: ["name", "objective", "organizationContext", "targetRoles", "talkingPoints", "defaultMailAccountId"],
  PARTNERSHIP: ["name", "objective", "organizationContext", "targetRoles", "talkingPoints", "defaultMailAccountId"],
  NETWORKING: ["name", "objective", "peopleContext", "networkingContext", "defaultMailAccountId"],
  CUSTOM: ["name", "objective", "notes", "defaultMailAccountId"]
};

const shortListItem = z.string().trim().min(1, "Enter a list item of at least 1 character.").max(100, "Each list item must be 100 characters or fewer.");
const shortList = (emptyMessage: string) => z.array(shortListItem).min(1, emptyMessage).max(20, "Enter at most 20 items.").transform((values) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});
const optionalText = z.string().trim().max(5000, "This field must be 5,000 characters or fewer.").default("");
const requiredContext = (message: string) => z.string().trim().min(2, message).max(5000, "This field must be 5,000 characters or fewer.");
const base = {
  name: z.string().trim().min(2, fieldFallbacks.name).max(120, "Project name must be 120 characters or fewer."),
  objective: z.string().trim().min(2, fieldFallbacks.objective).max(1000, "Objective must be 1,000 characters or fewer."),
  defaultMailAccountId: z.string().uuid({ error: fieldFallbacks.defaultMailAccountId })
};

export function parseOptionalCompensation(value: unknown, context: z.RefinementCtx) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "nan") {
    context.addIssue({ code: "custom", message: "Enter a whole-dollar annual amount, or leave this blank." });
    return z.NEVER;
  }
  const normalized = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isSafeInteger(normalized)) {
    context.addIssue({ code: "custom", message: "Enter a whole-dollar annual amount, or leave this blank." });
    return z.NEVER;
  }
  if (normalized < PROJECT_COMPENSATION_MIN || normalized > PROJECT_COMPENSATION_MAX) {
    context.addIssue({ code: "custom", message: fieldFallbacks.minimumCompensation });
    return z.NEVER;
  }
  return normalized;
}

const optionalAnnualCompensation = z.any().transform((value, context) => parseOptionalCompensation(value, context));

export const jobSearchParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetRoles: shortList(fieldFallbacks.targetRoles),
  keywords: shortList(fieldFallbacks.keywords),
  locationText: z.string().trim().max(200, fieldFallbacks.locationText).default(""),
  arrangements: z.array(z.enum(workArrangements, { error: "Select a valid work arrangement." })).min(1, fieldFallbacks.arrangements).max(3),
  minimumCompensation: optionalAnnualCompensation,
  seniority: z.array(z.enum(seniorityLevels, { error: "Select a valid seniority level." })).min(1, fieldFallbacks.seniority).max(6, "Select at most 6 seniority levels.")
});

export const businessOutreachParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetOrganizationNotes: requiredContext(fieldFallbacks.organizationContext),
  targetContactRoles: shortList("Enter at least one target contact role."),
  talkingPoints: optionalText
});

export const partnershipParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetOrganizationContext: requiredContext(fieldFallbacks.organizationContext),
  targetRoles: shortList(fieldFallbacks.targetRoles),
  partnershipContext: requiredContext("Enter at least 2 characters of partnership context.")
});

export const networkingParametersSchema = z.object({
  schemaVersion: z.literal(1),
  targetPeopleContext: requiredContext(fieldFallbacks.peopleContext),
  networkingContext: requiredContext(fieldFallbacks.networkingContext)
});

export const customParametersSchema = z.object({
  schemaVersion: z.literal(1),
  notes: requiredContext(fieldFallbacks.notes)
});

const createSchemas = {
  JOB_SEARCH: z.object({ type: z.literal("JOB_SEARCH"), ...base, parameters: jobSearchParametersSchema }),
  BUSINESS_OUTREACH: z.object({ type: z.literal("BUSINESS_OUTREACH"), ...base, parameters: businessOutreachParametersSchema }),
  PARTNERSHIP: z.object({ type: z.literal("PARTNERSHIP"), ...base, parameters: partnershipParametersSchema }),
  NETWORKING: z.object({ type: z.literal("NETWORKING"), ...base, parameters: networkingParametersSchema }),
  CUSTOM: z.object({ type: z.literal("CUSTOM"), ...base, parameters: customParametersSchema })
} as const;

export type ProjectCreateInput = z.infer<(typeof createSchemas)[ProjectType]>;

function issueField(path: PropertyKey[]) {
  const key = path.map(String).join(".");
  return pathToField[key] ?? pathToField[String(path[0])] ?? null;
}

function safeFieldMessage(field: ProjectFieldName, message: string) {
  return !message || genericSchemaMessage.test(message) ? fieldFallbacks[field] : message;
}

export function mapProjectFieldErrors(error: z.ZodError): ProjectFieldErrors {
  const fieldErrors: ProjectFieldErrors = {};
  for (const issue of error.issues) {
    const field = issueField(issue.path);
    if (!field || fieldErrors[field]) continue;
    fieldErrors[field] = safeFieldMessage(field, issue.message);
  }
  return fieldErrors;
}

export function projectValidationErrorPayload(error: z.ZodError) {
  return {
    error: "Check the highlighted Project details.",
    fieldErrors: mapProjectFieldErrors(error)
  };
}

export function firstInvalidProjectField(type: ProjectType, fieldErrors: ProjectFieldErrors) {
  return projectFieldFocusOrder[type].find((field) => fieldErrors[field]) ?? (Object.keys(fieldErrors)[0] as ProjectFieldName | undefined) ?? null;
}

export function parseProjectCreateInput(value: unknown): ProjectCreateInput {
  if (!value || typeof value !== "object" || !("type" in value) || !projectTypes.includes((value as { type: ProjectType }).type)) {
    throw new z.ZodError([{ code: "custom", path: ["type"], message: fieldFallbacks.type }]);
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
