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
