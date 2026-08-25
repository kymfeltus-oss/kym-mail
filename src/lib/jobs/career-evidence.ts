import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareerEvidence } from "@/lib/jobs/analysis";
import { JobAnalysisInputError } from "@/lib/jobs/analysis";

type Row = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function dateValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function compact(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ").slice(0, 2000);
}

function metricText(metric: Row) {
  const values = [
    metric.value_numeric, metric.value_text,
    metric.before_numeric, metric.before_text,
    metric.after_numeric, metric.after_text
  ].filter((value) => value !== null && value !== undefined && value !== "").map(String);
  return compact([
    stringValue(metric.metric_type).replaceAll("_", " "),
    values.join(" → "),
    stringValue(metric.unit),
    stringValue(metric.currency),
    stringValue(metric.qualifier),
    stringValue(metric.scope_text)
  ]);
}

async function checked<T extends Row>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new JobAnalysisInputError("CAREER_PROFILE_UNAVAILABLE", "The Master Career Profile could not be loaded.");
  return data ?? [];
}

function aliasesFor(aliases: Row[], type: string, id: string) {
  return aliases.filter((alias) => stringValue(alias.entity_type) === type && stringValue(alias.entity_id) === id).map((alias) => stringValue(alias.alias_text));
}

export async function careerProfileExists(database: SupabaseClient, ownerId: string) {
  const { count, error } = await database.from("career_profiles").select("owner_id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if (error) throw new JobAnalysisInputError("CAREER_PROFILE_UNAVAILABLE", "The Master Career Profile could not be loaded.");
  return (count ?? 0) > 0;
}

export async function loadCareerEvidence(database: SupabaseClient, ownerId: string): Promise<CareerEvidence[]> {
  const [profiles, organizations, titles, experiences, education, credentials, skills, projects, accomplishments, metrics, aliases, experienceSkills, projectSkills] = await Promise.all([
    checked(database.from("career_profiles").select("owner_id, full_name, professional_headline, professional_summary, years_experience_claim, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_organizations").select("id, canonical_name, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_titles").select("id, canonical_name, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_experiences").select("id, organization_id, client_organization_id, title_id, start_date, end_date, is_current, summary, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_education").select("id, degree_name, field_of_study, institution_name, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_credentials").select("id, credential_name, credential_status, issuing_organization, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_skills").select("id, canonical_name, category, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_projects").select("id, canonical_name, project_kind, summary, business_challenge, architecture, impact, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_accomplishments").select("id, category, statement, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_metrics").select("id, accomplishment_id, metric_type, value_numeric, value_text, before_numeric, before_text, after_numeric, after_text, unit, currency, qualifier, scope_text, authority_status, updated_at").eq("owner_id", ownerId)),
    checked(database.from("career_aliases").select("entity_type, entity_id, alias_text").eq("owner_id", ownerId)),
    checked(database.from("career_experience_skills").select("experience_id, skill_id").eq("owner_id", ownerId)),
    checked(database.from("career_project_skills").select("project_id, skill_id").eq("owner_id", ownerId))
  ]);

  if (!profiles.length) throw new JobAnalysisInputError("CAREER_PROFILE_UNAVAILABLE", "The Master Career Profile is unavailable.");
  const organizationById = new Map(organizations.map((row) => [stringValue(row.id), stringValue(row.canonical_name)]));
  const titleById = new Map(titles.map((row) => [stringValue(row.id), stringValue(row.canonical_name)]));
  const skillById = new Map(skills.map((row) => [stringValue(row.id), stringValue(row.canonical_name)]));
  const accomplishmentById = new Map(accomplishments.map((row) => [stringValue(row.id), stringValue(row.statement)]));
  const skillsByExperience = new Map<string, string[]>();
  for (const row of experienceSkills) {
    const name = skillById.get(stringValue(row.skill_id));
    if (!name) continue;
    const key = stringValue(row.experience_id);
    skillsByExperience.set(key, [...(skillsByExperience.get(key) ?? []), name]);
  }
  const skillsByProject = new Map<string, string[]>();
  for (const row of projectSkills) {
    const name = skillById.get(stringValue(row.skill_id));
    if (!name) continue;
    const key = stringValue(row.project_id);
    skillsByProject.set(key, [...(skillsByProject.get(key) ?? []), name]);
  }
  const evidence: CareerEvidence[] = [];

  for (const profile of profiles) {
    const yearsClaim = stringValue(profile.years_experience_claim);
    const label = stringValue(profile.professional_headline) || stringValue(profile.full_name);
    const text = compact([stringValue(profile.full_name), stringValue(profile.professional_headline), stringValue(profile.professional_summary), yearsClaim ? `${yearsClaim} years experience` : null]);
    if (!label || text.length < 3) continue;
    evidence.push({
      id: stringValue(profile.owner_id),
      type: "PROFILE",
      label,
      text,
      metadata: { authorityStatus: stringValue(profile.authority_status), yearsExperience: Number.parseInt(yearsClaim, 10) || 0 },
      updatedAt: dateValue(profile.updated_at)
    });
  }
  for (const experience of experiences) {
    const id = stringValue(experience.id);
    const employer = organizationById.get(stringValue(experience.organization_id)) ?? "Career experience";
    const client = organizationById.get(stringValue(experience.client_organization_id));
    const title = titleById.get(stringValue(experience.title_id)) ?? "Career experience";
    const label = `${title} — ${employer}`.slice(0, 300);
    const text = compact([
      title,
      employer,
      client ? `Client: ${client}` : null,
      stringValue(experience.summary),
      stringValue(experience.start_date),
      experience.is_current ? "Current" : stringValue(experience.end_date),
      ...(skillsByExperience.get(id) ?? []),
      ...aliasesFor(aliases, "ORGANIZATION", stringValue(experience.organization_id)),
      ...aliasesFor(aliases, "TITLE", stringValue(experience.title_id))
    ]);
    if (text.length < 3) continue;
    evidence.push({
      id,
      type: "EXPERIENCE",
      label,
      text,
      metadata: { authorityStatus: stringValue(experience.authority_status) },
      updatedAt: dateValue(experience.updated_at)
    });
  }
  for (const item of education) {
    const label = compact([stringValue(item.degree_name), stringValue(item.field_of_study)]) || "Education";
    const text = compact([label, stringValue(item.institution_name)]);
    if (text.length < 3) continue;
    evidence.push({
      id: stringValue(item.id),
      type: "EDUCATION",
      label: label.slice(0, 300),
      text,
      metadata: { authorityStatus: stringValue(item.authority_status) },
      updatedAt: dateValue(item.updated_at)
    });
  }
  for (const item of credentials) {
    const label = stringValue(item.credential_name);
    const text = compact([label, stringValue(item.credential_status), stringValue(item.issuing_organization)]);
    if (!label || text.length < 3) continue;
    evidence.push({
      id: stringValue(item.id),
      type: "CREDENTIAL",
      label: label.slice(0, 300),
      text,
      metadata: { authorityStatus: stringValue(item.authority_status), credentialStatus: stringValue(item.credential_status) },
      updatedAt: dateValue(item.updated_at)
    });
  }
  for (const item of skills) {
    const id = stringValue(item.id);
    const label = stringValue(item.canonical_name);
    const text = compact([label, stringValue(item.category), ...aliasesFor(aliases, "SKILL", id)]);
    if (!label || text.length < 3) continue;
    evidence.push({
      id,
      type: "SKILL",
      label: label.slice(0, 300),
      text,
      category: stringValue(item.category),
      metadata: { authorityStatus: stringValue(item.authority_status) },
      updatedAt: dateValue(item.updated_at)
    });
  }
  for (const project of projects) {
    const id = stringValue(project.id);
    const label = stringValue(project.canonical_name);
    const text = compact([
      label,
      stringValue(project.project_kind),
      stringValue(project.summary),
      stringValue(project.business_challenge),
      stringValue(project.architecture),
      stringValue(project.impact),
      ...(skillsByProject.get(id) ?? []),
      ...aliasesFor(aliases, "PROJECT", id)
    ]);
    if (!label || text.length < 3) continue;
    evidence.push({
      id,
      type: "PROJECT",
      label: label.slice(0, 300),
      text,
      metadata: { authorityStatus: stringValue(project.authority_status) },
      updatedAt: dateValue(project.updated_at)
    });
  }
  for (const accomplishment of accomplishments) {
    const statement = stringValue(accomplishment.statement);
    const text = compact([stringValue(accomplishment.category), statement]);
    if (text.length < 3) continue;
    evidence.push({
      id: stringValue(accomplishment.id),
      type: "ACCOMPLISHMENT",
      label: statement.slice(0, 160) || "Accomplishment",
      text,
      category: stringValue(accomplishment.category),
      metadata: { authorityStatus: stringValue(accomplishment.authority_status) },
      updatedAt: dateValue(accomplishment.updated_at)
    });
  }
  for (const metric of metrics) {
    const metricSummary = metricText(metric);
    const text = compact([accomplishmentById.get(stringValue(metric.accomplishment_id)), metricSummary]);
    if (text.length < 3) continue;
    evidence.push({
      id: stringValue(metric.id),
      type: "METRIC",
      label: metricSummary.slice(0, 160) || "Quantified metric",
      text,
      metadata: { authorityStatus: stringValue(metric.authority_status) },
      updatedAt: dateValue(metric.updated_at)
    });
  }
  return evidence.filter((item) => item.id && item.label && item.text.length >= 3);
}
