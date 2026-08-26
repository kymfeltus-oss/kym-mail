import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { CareerEntityType } from "@/lib/resumes/types";

export type CareerFact = { type: CareerEntityType; id: string; label: string; text: string };
export type CareerFacts = {
  profile: { ownerId: string; fullName: string; headline: string; location: string | null; summary: string; years: string | null };
  organizations: Array<{ id: string; name: string }>;
  titles: Array<{ id: string; name: string }>;
  experiences: Array<{ id: string; organizationId: string; clientOrganizationId: string | null; titleId: string | null; startDate: string | null; startPrecision: "MONTH" | "YEAR" | "UNKNOWN"; endDate: string | null; endPrecision: "MONTH" | "YEAR" | "UNKNOWN"; isCurrent: boolean; location: string | null; summary: string | null; completeness: "COMPLETE" | "PARTIAL" }>;
  education: Array<{ id: string; degree: string; fieldOfStudy: string | null; institution: string; completedOn: string | null }>;
  credentials: Array<{ id: string; name: string; status: "ACTIVE" | "INACTIVE" | "COMPLETED" | "CANDIDATE" }>;
  skills: Array<{ id: string; name: string; category: "FINANCE" | "ACCOUNTING" | "TECHNOLOGY" | "SYSTEM" | "DATA" | "LEADERSHIP" | "INDUSTRY" }>;
  projects: Array<{ id: string; name: string; experienceId: string | null; summary: string; challenge: string | null; architecture: string | null; impact: string | null }>;
  accomplishments: Array<{ id: string; experienceId: string | null; projectId: string | null; statement: string }>;
  metrics: Array<{ id: string; accomplishmentId: string; sourceText: string }>;
  aliases: Array<{ type: CareerEntityType; entityId: string; alias: string }>;
  factsByKey: Map<string, CareerFact>;
  fingerprint: string;
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function metricText(row: Record<string, unknown>) {
  return [row.value_numeric, row.value_text, row.before_numeric, row.before_text, row.after_numeric, row.after_text, row.unit, row.currency, row.qualifier, row.scope_text].filter((value) => value !== null && value !== undefined).join(" ");
}

export async function loadCareerFacts(database: SupabaseClient, ownerId: string): Promise<CareerFacts> {
  const confirmedAuthority = ["AUTHORITATIVE", "RESOLVED"];
  const queries = await Promise.all([
    database.from("career_profiles").select("owner_id, full_name, professional_headline, location_text, professional_summary, years_experience_claim").eq("owner_id", ownerId).in("authority_status", confirmedAuthority).single(),
    database.from("career_organizations").select("id, canonical_name").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_titles").select("id, canonical_name").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_experiences").select("id, organization_id, client_organization_id, title_id, start_date, start_precision, end_date, end_precision, is_current, location_text, summary, completeness").eq("owner_id", ownerId).in("authority_status", confirmedAuthority).order("start_date", { ascending: false, nullsFirst: false }),
    database.from("career_education").select("id, degree_name, field_of_study, institution_name, completed_on").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_credentials").select("id, credential_name, credential_status").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_skills").select("id, canonical_name, category").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_projects").select("id, canonical_name, experience_id, summary, business_challenge, architecture, impact").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_accomplishments").select("id, experience_id, project_id, statement").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_metrics").select("id, accomplishment_id, value_numeric, value_text, before_numeric, before_text, after_numeric, after_text, unit, currency, qualifier, scope_text").eq("owner_id", ownerId).in("authority_status", confirmedAuthority),
    database.from("career_aliases").select("entity_type, entity_id, alias_text").eq("owner_id", ownerId)
  ]);
  const failed = queries.find((query) => query.error);
  if (failed?.error) throw new Error("CAREER_PROFILE_UNAVAILABLE");
  const p = queries[0].data as Record<string, unknown>;
  const organizations = ((queries[1].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.canonical_name) }));
  const titles = ((queries[2].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.canonical_name) }));
  const experiences = ((queries[3].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), organizationId: String(row.organization_id), clientOrganizationId: row.client_organization_id ? String(row.client_organization_id) : null, titleId: row.title_id ? String(row.title_id) : null, startDate: row.start_date ? String(row.start_date) : null, startPrecision: row.start_precision as "MONTH" | "YEAR" | "UNKNOWN", endDate: row.end_date ? String(row.end_date) : null, endPrecision: row.end_precision as "MONTH" | "YEAR" | "UNKNOWN", isCurrent: Boolean(row.is_current), location: row.location_text ? String(row.location_text) : null, summary: row.summary ? String(row.summary) : null, completeness: row.completeness as "COMPLETE" | "PARTIAL" }));
  const education = ((queries[4].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), degree: String(row.degree_name), fieldOfStudy: row.field_of_study ? String(row.field_of_study) : null, institution: String(row.institution_name), completedOn: row.completed_on ? String(row.completed_on) : null }));
  const credentials = ((queries[5].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.credential_name), status: row.credential_status as "ACTIVE" | "INACTIVE" | "COMPLETED" | "CANDIDATE" }));
  const skills = ((queries[6].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.canonical_name), category: row.category as CareerFacts["skills"][number]["category"] }));
  const projects = ((queries[7].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), name: String(row.canonical_name), experienceId: row.experience_id ? String(row.experience_id) : null, summary: String(row.summary), challenge: row.business_challenge ? String(row.business_challenge) : null, architecture: row.architecture ? String(row.architecture) : null, impact: row.impact ? String(row.impact) : null }));
  const accomplishments = ((queries[8].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), experienceId: row.experience_id ? String(row.experience_id) : null, projectId: row.project_id ? String(row.project_id) : null, statement: String(row.statement) }));
  const metrics = ((queries[9].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), accomplishmentId: String(row.accomplishment_id), sourceText: metricText(row) }));
  const aliases = ((queries[10].data ?? []) as Array<Record<string, unknown>>).map((row) => ({ type: row.entity_type as CareerEntityType, entityId: String(row.entity_id), alias: String(row.alias_text) }));
  const profile = { ownerId: String(p.owner_id), fullName: String(p.full_name), headline: String(p.professional_headline), location: p.location_text ? String(p.location_text) : null, summary: String(p.professional_summary), years: p.years_experience_claim ? String(p.years_experience_claim) : null };
  const facts: CareerFact[] = [
    { type: "PROFILE", id: ownerId, label: profile.fullName, text: `${profile.headline}. ${profile.summary}` },
    ...organizations.map((item) => ({ type: "ORGANIZATION" as const, id: item.id, label: item.name, text: item.name })),
    ...titles.map((item) => ({ type: "TITLE" as const, id: item.id, label: item.name, text: item.name })),
    ...experiences.map((item) => ({ type: "EXPERIENCE" as const, id: item.id, label: item.summary ?? "Career experience", text: [item.summary, item.startDate, item.endDate].filter(Boolean).join(" ") })),
    ...education.map((item) => ({ type: "EDUCATION" as const, id: item.id, label: `${item.degree}${item.fieldOfStudy ? ` in ${item.fieldOfStudy}` : ""}`, text: `${item.degree} ${item.fieldOfStudy ?? ""} ${item.institution}` })),
    ...credentials.map((item) => ({ type: "CREDENTIAL" as const, id: item.id, label: item.name, text: `${item.name} ${item.status}` })),
    ...skills.map((item) => ({ type: "SKILL" as const, id: item.id, label: item.name, text: item.name })),
    ...projects.map((item) => ({ type: "PROJECT" as const, id: item.id, label: item.name, text: [item.summary, item.challenge, item.architecture, item.impact].filter(Boolean).join(" ") })),
    ...accomplishments.map((item) => ({ type: "ACCOMPLISHMENT" as const, id: item.id, label: item.statement.slice(0, 120), text: item.statement })),
    ...metrics.map((item) => ({ type: "METRIC" as const, id: item.id, label: item.sourceText.slice(0, 120), text: item.sourceText }))
  ];
  return { profile, organizations, titles, experiences, education, credentials, skills, projects, accomplishments, metrics, aliases, factsByKey: new Map(facts.map((fact) => [`${fact.type}:${fact.id}`, fact])), fingerprint: hash({ profile, organizations, titles, experiences, education, credentials, skills, projects, accomplishments, metrics, aliases }) };
}
