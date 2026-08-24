import type { ProjectType } from "@/lib/projects/constants";

const arrangementLabels: Record<string, string> = { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "Onsite" };
const seniorityLabels: Record<string, string> = { MANAGER: "Manager", SENIOR_MANAGER: "Senior Manager", DIRECTOR: "Director", SENIOR_DIRECTOR: "Senior Director", VP: "VP", C_SUITE: "C-Suite" };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function list(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function ProjectParameters({ type, parameters }: { type: ProjectType; parameters: Record<string, unknown> }) {
  const rows: { label: string; value: string | string[] }[] = [];
  if (type === "JOB_SEARCH") {
    rows.push(
      { label: "Target roles", value: list(parameters.targetRoles) },
      { label: "Keywords / skills", value: list(parameters.keywords) },
      { label: "Location", value: text(parameters.locationText) || "Flexible" },
      { label: "Work arrangement", value: list(parameters.arrangements).map((item) => arrangementLabels[item] ?? item) },
      { label: "Seniority", value: list(parameters.seniority).map((item) => seniorityLabels[item] ?? item) }
    );
    if (typeof parameters.minimumCompensation === "number") rows.push({ label: "Minimum target compensation", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(parameters.minimumCompensation) });
  } else if (type === "BUSINESS_OUTREACH") {
    rows.push({ label: "Target organization / industry", value: text(parameters.targetOrganizationNotes) }, { label: "Target contact roles", value: list(parameters.targetContactRoles) });
    if (text(parameters.talkingPoints)) rows.push({ label: "Messaging context / talking points", value: text(parameters.talkingPoints) });
  } else if (type === "PARTNERSHIP") {
    rows.push({ label: "Target organization / context", value: text(parameters.targetOrganizationContext) }, { label: "Target roles", value: list(parameters.targetRoles) }, { label: "Partnership context / talking points", value: text(parameters.partnershipContext) });
  } else if (type === "NETWORKING") {
    rows.push({ label: "Target people / role context", value: text(parameters.targetPeopleContext) }, { label: "Networking context", value: text(parameters.networkingContext) });
  } else rows.push({ label: "Notes / context", value: text(parameters.notes) });

  return <dl className="grid gap-4 sm:grid-cols-2">{rows.map((row) => <div key={row.label} className="rounded-2xl border border-[#E8E2E3] bg-[#FFFCFB] p-4"><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]">{row.label}</dt><dd className="mt-3 text-sm leading-6 text-[#183A5A]">{Array.isArray(row.value) ? <span className="flex flex-wrap gap-2">{row.value.map((item) => <span key={item} className="rounded-full bg-[#FFF3F4] px-3 py-1 text-xs font-semibold text-[#A73D52]">{item}</span>)}</span> : row.value}</dd></div>)}</dl>;
}
