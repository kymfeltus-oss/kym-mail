import { describe, expect, it } from "vitest";
import { parseProjectCreateInput, parseProjectUpdateInput, splitProjectList } from "@/lib/projects/validation";

const identityId = "181a7f0b-a5aa-4fbd-a50f-8cb6167bc4be";

describe("Project validation", () => {
  it("validates and normalizes a Job Search Project", () => {
    const result = parseProjectCreateInput({
      type: "JOB_SEARCH",
      name: " Finance leadership ",
      objective: "Find the right role",
      defaultMailAccountId: identityId,
      parameters: {
        schemaVersion: 1,
        targetRoles: ["Director", "director", "Controller"],
        keywords: ["Workday"],
        locationText: "Remote",
        arrangements: ["REMOTE"],
        minimumCompensation: 175000,
        seniority: ["DIRECTOR"]
      }
    });
    expect(result.name).toBe("Finance leadership");
    if (result.type !== "JOB_SEARCH") throw new Error("Expected Job Search Project");
    expect(result.parameters.targetRoles).toEqual(["Director", "Controller"]);
  });

  it("rejects missing type-specific fields", () => {
    expect(() => parseProjectCreateInput({
      type: "CUSTOM",
      name: "Custom work",
      objective: "Organize work",
      defaultMailAccountId: identityId,
      parameters: { schemaVersion: 1, notes: "" }
    })).toThrow();
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
});
