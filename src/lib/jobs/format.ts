import type { EmploymentType, NormalizedJob, WorkArrangement } from "@/domain/providers/job-search-provider";

export const workArrangementLabels: Record<WorkArrangement, string> = { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "Onsite", UNKNOWN: "Work arrangement not specified" };
export const employmentTypeLabels: Record<EmploymentType, string> = { FULL_TIME: "Full time", PART_TIME: "Part time", CONTRACT: "Contract", PERMANENT: "Permanent" };

export function formatJobSalary(job: Pick<NormalizedJob, "salaryMinimum" | "salaryMaximum" | "salaryCurrency" | "salaryPeriod">) {
  if (job.salaryMinimum === null && job.salaryMaximum === null) return null;
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: job.salaryCurrency ?? "USD", maximumFractionDigits: 0 });
  const period = job.salaryPeriod === "YEAR" ? " / year" : "";
  if (job.salaryMinimum !== null && job.salaryMaximum !== null && job.salaryMinimum !== job.salaryMaximum) return `${formatter.format(job.salaryMinimum)}–${formatter.format(job.salaryMaximum)}${period}`;
  return `${formatter.format(job.salaryMinimum ?? job.salaryMaximum ?? 0)}${period}`;
}

export function formatJobPostedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
