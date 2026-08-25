import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  PROJECT_COMPENSATION_MAX,
  PROJECT_COMPENSATION_MIN,
  firstInvalidProjectField,
  mapProjectFieldErrors,
  parseProjectCreateInput,
  parseProjectUpdateInput,
  projectValidationErrorPayload,
  splitProjectList
} from "@/lib/projects/validation";

const identityId = "181a7f0b-a5aa-4fbd-a50f-8cb6167bc4be";

function jobSearchInput(overrides: Record<string, unknown> = {}) {
  return {
    type: "JOB_SEARCH" as const,
    name: "Finance leadership",
    objective: "Find the right role",
    defaultMailAccountId: identityId,
    parameters: {
      schemaVersion: 1,
      targetRoles: ["Director", "Controller"],
      keywords: ["Workday"],
      locationText: "Dallas",
      arrangements: ["REMOTE"],
      minimumCompensation: 175000,
      seniority: ["DIRECTOR"],
      ...((overrides.parameters as Record<string, unknown> | undefined) ?? {})
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "parameters"))
  };
}

function fieldErrors(value: unknown) {
  try {
    parseProjectCreateInput(value);
    throw new Error("Expected validation to fail");
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return mapProjectFieldErrors(error);
  }
}

describe("Project validation", () => {
  it("validates and normalizes a Job Search Project with seniority and compensation", () => {
    const result = parseProjectCreateInput(jobSearchInput({
      parameters: {
        schemaVersion: 1,
        targetRoles: ["Director", "director", "Controller"],
        keywords: ["Workday"],
        locationText: "Remote",
        arrangements: ["REMOTE"],
        minimumCompensation: 175000,
        seniority: ["DIRECTOR"]
      }
    }));
    expect(result.name).toBe("Finance leadership");
    if (result.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(result.parameters.targetRoles).toEqual(["Director", "Controller"]);
    expect(result.parameters.minimumCompensation).toBe(175000);
    expect(result.parameters.seniority).toEqual(["DIRECTOR"]);
  });

  it("accepts optional Job Search fields omitted", () => {
    const result = parseProjectCreateInput(jobSearchInput({
      parameters: {
        schemaVersion: 1,
        targetRoles: ["Controller"],
        keywords: ["ASC 606"],
        locationText: "",
        arrangements: ["HYBRID"],
        minimumCompensation: null,
        seniority: ["SENIOR_MANAGER"]
      }
    }));
    if (result.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(result.parameters.locationText).toBe("");
    expect(result.parameters.minimumCompensation).toBeNull();
  });

  it("accepts the compensation boundaries of 1 and 10,000,000", () => {
    const minimum = parseProjectCreateInput(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Controller"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: PROJECT_COMPENSATION_MIN, seniority: ["MANAGER"] }
    }));
    const maximum = parseProjectCreateInput(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Controller"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: PROJECT_COMPENSATION_MAX, seniority: ["MANAGER"] }
    }));
    if (minimum.type !== "JOB_SEARCH" || maximum.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(minimum.parameters.minimumCompensation).toBe(1);
    expect(maximum.parameters.minimumCompensation).toBe(10_000_000);
  });

  it("accepts 2000 as a valid annual compensation amount", () => {
    const result = parseProjectCreateInput(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Controller"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 2000, seniority: ["DIRECTOR"] }
    }));
    if (result.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(result.parameters.minimumCompensation).toBe(2000);
  });

  it("rejects missing seniority with a field-level message", () => {
    const errors = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 2000, seniority: [] }
    }));
    expect(errors.seniority).toBe("Select at least one seniority level.");
    expect(Object.values(errors).join(" ")).not.toMatch(/invalid input/i);
  });

  it("rejects missing work arrangement with a field-level message", () => {
    const errors = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: [], minimumCompensation: 2000, seniority: ["DIRECTOR"] }
    }));
    expect(errors.arrangements).toBe("Select at least one work arrangement.");
  });

  it("rejects compensation below the positive whole-dollar minimum", () => {
    const errors = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 0, seniority: ["DIRECTOR"] }
    }));
    expect(errors.minimumCompensation).toMatch(/whole-dollar annual amount/i);
  });

  it("rejects invalid numeric compensation", () => {
    const decimal = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 12.5, seniority: ["DIRECTOR"] }
    }));
    const nan = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: Number("abc"), seniority: ["DIRECTOR"] }
    }));
    expect(decimal.minimumCompensation).toBe("Enter a whole-dollar annual amount, or leave this blank.");
    expect(nan.minimumCompensation).toBe("Enter a whole-dollar annual amount, or leave this blank.");
  });

  it("rejects a missing required text field", () => {
    const errors = fieldErrors(jobSearchInput({ name: " " }));
    expect(errors.name).toBe("Enter a Project name of at least 2 characters.");
  });

  it("maps multiple simultaneous validation failures to the correct fields", () => {
    const errors = fieldErrors(jobSearchInput({
      name: "A",
      parameters: {
        schemaVersion: 1,
        targetRoles: [],
        keywords: [],
        locationText: "",
        arrangements: [],
        minimumCompensation: 0,
        seniority: []
      }
    }));
    expect(errors.name).toBe("Enter a Project name of at least 2 characters.");
    expect(errors.targetRoles).toBe("Enter at least one target role.");
    expect(errors.keywords).toBe("Enter at least one keyword or skill.");
    expect(errors.arrangements).toBe("Select at least one work arrangement.");
    expect(errors.seniority).toBe("Select at least one seniority level.");
    expect(errors.minimumCompensation).toBeDefined();
    expect(firstInvalidProjectField("JOB_SEARCH", errors)).toBe("name");
    expect(JSON.stringify(errors).toLowerCase()).not.toContain("invalid input");
  });

  it("uses form order so the first invalid field is focused, including seniority when it is first", () => {
    const errors = fieldErrors(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 0, seniority: [] }
    }));
    expect(firstInvalidProjectField("JOB_SEARCH", errors)).toBe("minimumCompensation");
    expect(firstInvalidProjectField("JOB_SEARCH", { seniority: "Select at least one seniority level." })).toBe("seniority");
  });

  it("returns a structured payload instead of a raw Zod message", () => {
    try {
      parseProjectCreateInput(jobSearchInput({
        parameters: { schemaVersion: 1, targetRoles: ["Director"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: 2000, seniority: [] }
      }));
      throw new Error("Expected validation to fail");
    } catch (error) {
      if (!(error instanceof z.ZodError)) throw error;
      const payload = projectValidationErrorPayload(error);
      expect(payload.error).toBe("Check the highlighted Project details.");
      expect(payload.fieldErrors.seniority).toBe("Select at least one seniority level.");
      expect(payload.error.toLowerCase()).not.toContain("invalid input");
    }
  });

  it("rejects missing type-specific fields", () => {
    expect(() => parseProjectCreateInput({
      type: "CUSTOM",
      name: "Custom work",
      objective: "Organize work",
      defaultMailAccountId: identityId,
      parameters: { schemaVersion: 1, notes: "" }
    })).toThrow();
    expect(fieldErrors({
      type: "CUSTOM",
      name: "Custom work",
      objective: "Organize work",
      defaultMailAccountId: identityId,
      parameters: { schemaVersion: 1, notes: "" }
    }).notes).toBe("Enter at least 2 characters of notes or context.");
  });

  it("rejects an invalid Project name", () => {
    expect(() => parseProjectCreateInput({
      type: "CUSTOM",
      name: " ",
      objective: "Organize work",
      defaultMailAccountId: identityId,
      parameters: { schemaVersion: 1, notes: "A bounded custom context" }
    })).toThrow();
  });

  it("rejects malformed versioned parameters", () => {
    expect(() => parseProjectCreateInput({
      type: "JOB_SEARCH",
      name: "Finance search",
      objective: "Find a leadership role",
      defaultMailAccountId: identityId,
      parameters: {
        schemaVersion: 2,
        targetRoles: "Director",
        keywords: [],
        arrangements: ["ANYWHERE"],
        minimumCompensation: "175000",
        seniority: []
      }
    })).toThrow();
  });

  it("does not permit changing type through the update parser", () => {
    const value = {
      name: "Partner work",
      objective: "Build a partnership",
      defaultMailAccountId: identityId,
      parameters: {
        schemaVersion: 1,
        targetOrganizationContext: "A relevant organization",
        targetRoles: ["CFO"],
        partnershipContext: "A mutually useful partnership"
      }
    };
    expect(parseProjectUpdateInput("PARTNERSHIP", { ...value, type: "CUSTOM" }).type).toBe("PARTNERSHIP");
  });

  it("splits comma and newline lists deterministically", () => {
    expect(splitProjectList("Director, Controller\nFinance Systems")).toEqual(["Director", "Controller", "Finance Systems"]);
  });

  it("accepts formatted currency strings for optional compensation", () => {
    const result = parseProjectCreateInput(jobSearchInput({
      parameters: { schemaVersion: 1, targetRoles: ["Controller"], keywords: ["Workday"], locationText: "", arrangements: ["REMOTE"], minimumCompensation: "$2,000", seniority: ["DIRECTOR"] }
    }));
    if (result.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(result.parameters.minimumCompensation).toBe(2000);
  });
});
