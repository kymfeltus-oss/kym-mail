export const projectTypes = ["JOB_SEARCH", "BUSINESS_OUTREACH", "PARTNERSHIP", "NETWORKING", "CUSTOM"] as const;
export const projectStatuses = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
export type ProjectType = (typeof projectTypes)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export const projectTypeLabels: Record<ProjectType, string> = {
  JOB_SEARCH: "Job Search",
  BUSINESS_OUTREACH: "Business Outreach",
  PARTNERSHIP: "Partnership",
  NETWORKING: "Networking",
  CUSTOM: "Custom"
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived"
};

export const workArrangements = ["REMOTE", "HYBRID", "ONSITE"] as const;
export type WorkArrangementPreference = (typeof workArrangements)[number];
export const workArrangementLabels: Record<WorkArrangementPreference, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite"
};

export const seniorityLevels = ["MANAGER", "SENIOR_MANAGER", "DIRECTOR", "SENIOR_DIRECTOR", "VP", "C_SUITE"] as const;
export type SeniorityLevel = (typeof seniorityLevels)[number];
export const seniorityLevelLabels: Record<SeniorityLevel, string> = {
  MANAGER: "Manager",
  SENIOR_MANAGER: "Senior Manager",
  DIRECTOR: "Director",
  SENIOR_DIRECTOR: "Senior Director",
  VP: "VP",
  C_SUITE: "C-Suite"
};

export const PROJECT_COMPENSATION_MIN = 1;
export const PROJECT_COMPENSATION_MAX = 10_000_000;
