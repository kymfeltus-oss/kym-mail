export function formatResumeDate(value: string | null, precision: "MONTH" | "YEAR" | "UNKNOWN", current = false) {
  if (current) return "Present";
  if (!value || precision === "UNKNOWN") return "Date not provided";
  const date = new Date(`${value}T00:00:00Z`);
  return precision === "YEAR" ? String(date.getUTCFullYear()) : new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function safeResumeFilename(name: string, employer: string, title: string, extension: "docx" | "pdf") {
  const slug = `${name}-${employer}-${title}`.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 145);
  return `${slug || "KYM-Mail-Tailored-Resume"}.${extension}`;
}

