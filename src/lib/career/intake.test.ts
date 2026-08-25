import { describe, expect, it } from "vitest";
import { assertAuthorityCanReplace, parseCareerIntake, type CareerIntake } from "@/lib/career/intake";

function validIntake(): CareerIntake {
  return {
    sources: [{ sourceKey: "KF_RESUME", label: "KF Resume", sourceKind: "RESUME", authorityStatus: "AUTHORITATIVE", authorityScope: ["dates", "titles"], contentSha256: "a".repeat(64), reviewedAt: "2026-08-24T01:00:00-05:00" }],
    profile: { fullName: "Kym Feltus, MBA", professionalHeadline: "Finance Systems Executive", locationText: "DFW, Texas", professionalSummary: "Finance and technology leader with enterprise experience.", yearsExperienceClaim: "23+", authorityStatus: "RESOLVED" },
    organizations: [{ canonicalKey: "ASTON_CARTER", canonicalName: "Aston Carter", organizationKind: "EMPLOYER", authorityStatus: "AUTHORITATIVE" }, { canonicalKey: "ESI", canonicalName: "ESI", organizationKind: "CLIENT", authorityStatus: "RESOLVED" }],
    titles: [{ canonicalKey: "FINANCE_DATA_AUTOMATION_CONSULTANT", canonicalName: "Finance & Data Automation Consultant (Technical Project)", authorityStatus: "AUTHORITATIVE" }],
    skills: [{ canonicalKey: "PYTHON", canonicalName: "Python", category: "TECHNOLOGY", authorityStatus: "AUTHORITATIVE" }],
    experiences: [{ canonicalKey: "ASTON_CARTER_2025", organizationKey: "ASTON_CARTER", clientOrganizationKey: "ESI", titleKey: "FINANCE_DATA_AUTOMATION_CONSULTANT", startDate: "2025-08-01", startPrecision: "MONTH", endDate: "2026-08-01", endPrecision: "MONTH", isCurrent: false, locationText: null, summary: "ASC 606 engagement", completeness: "COMPLETE", authorityStatus: "RESOLVED", skillKeys: ["PYTHON"] }],
    education: [], credentials: [],
    projects: [{ canonicalKey: "ASC606_REVENUE_ENGINE", canonicalName: "ASC606 Revenue Engine", projectKind: "TECHNICAL_PROJECT", experienceKey: "ASTON_CARTER_2025", clientOrganizationKey: "ESI", summary: "ASC 606 audit and revenue automation project.", businessChallenge: null, architecture: null, impact: null, authorityStatus: "RESOLVED", skillKeys: ["PYTHON"] }],
    accomplishments: [{ canonicalKey: "ASC606_PIPELINE", experienceKey: "ASTON_CARTER_2025", projectKey: "ASC606_REVENUE_ENGINE", category: "AUTOMATION", statement: "Automated more than four million billing records.", authorityStatus: "RESOLVED" }],
    metrics: [{ canonicalKey: "ASC606_RECORDS", accomplishmentKey: "ASC606_PIPELINE", metricType: "RECORD_COUNT", valueNumeric: 4_000_000, valueText: null, beforeNumeric: null, beforeText: null, afterNumeric: null, afterText: null, unit: "RECORDS", currency: null, qualifier: "MINIMUM", scopeText: "Billing records", authorityStatus: "RESOLVED" }],
    aliases: [{ entityType: "PROJECT", entityKey: "ASC606_REVENUE_ENGINE", aliasText: "ASC 606 Audit Automation" }],
    provenance: [{ sourceKey: "KF_RESUME", entityType: "PROJECT", entityKey: "ASC606_REVENUE_ENGINE", fieldName: "canonical_name", sourcePage: 1, sourceWording: "ASC606 Revenue Engine", sourceRole: "AUTHORITATIVE", resolutionNote: "Owner confirmed both project names describe one project." }],
  };
}

describe("career intake", () => {
  it("accepts a canonical project with a preserved alternate name", () => {
    const result = parseCareerIntake(validIntake());
    expect(result.projects).toHaveLength(1);
    expect(result.aliases[0].aliasText).toBe("ASC 606 Audit Automation");
  });

  it("rejects duplicates and invalid relationships", () => {
    const duplicate = validIntake();
    duplicate.projects.push({ ...duplicate.projects[0] });
    expect(() => parseCareerIntake(duplicate)).toThrow("Duplicate project canonical key");

    const orphan = validIntake();
    orphan.projects[0].experienceKey = "UNKNOWN_EXPERIENCE";
    expect(() => parseCareerIntake(orphan)).toThrow("Unknown project experience");
  });

  it("rejects invalid employment dates and orphaned accomplishments", () => {
    const dates = validIntake();
    dates.experiences[0].endDate = "2024-01-01";
    expect(() => parseCareerIntake(dates)).toThrow("Invalid experience date range");

    const orphan = validIntake();
    orphan.accomplishments[0].experienceKey = null;
    orphan.accomplishments[0].projectKey = null;
    expect(() => parseCareerIntake(orphan)).toThrow("Orphaned accomplishment");
  });

  it("prevents supplemental data from replacing higher-authority facts", () => {
    expect(() => assertAuthorityCanReplace("RESOLVED", "SUPPLEMENTAL")).toThrow("Authority downgrade rejected");
    expect(() => assertAuthorityCanReplace("AUTHORITATIVE", "SUPPLEMENTAL")).toThrow("Authority downgrade rejected");
    expect(() => assertAuthorityCanReplace("SUPPLEMENTAL", "RESOLVED")).not.toThrow();
  });
});
