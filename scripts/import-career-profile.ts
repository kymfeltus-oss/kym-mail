import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertAuthorityCanReplace, parseCareerIntake, type CareerAuthority, type CareerIntake } from "../src/lib/career/intake.ts";

const environmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  KYM_DEV_OWNER_EMAIL: z.string().email(),
});

type Database = SupabaseClient;
type EntityMap = Map<string, string>;
type CanonicalRow = { canonical_key: string; authority_status: CareerAuthority };

async function requireSuccess<T>(operation: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await operation;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return data;
}

async function resolveOwnerId(database: Database, ownerEmail: string) {
  const { data, error } = await database.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Career owner lookup failed.");
  const owner = data.users.find((user) => user.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) throw new Error("Career owner does not exist.");
  return owner.id;
}

async function guardCanonicalAuthority(database: Database, table: string, ownerId: string, rows: CanonicalRow[]) {
  if (rows.length === 0) return;
  const existing = await requireSuccess(
    database.from(table).select("canonical_key, authority_status").eq("owner_id", ownerId).in("canonical_key", rows.map((row) => row.canonical_key)),
    `Read ${table} authority`,
  ) as CanonicalRow[];
  const incoming = new Map(rows.map((row) => [row.canonical_key, row.authority_status]));
  for (const record of existing) assertAuthorityCanReplace(record.authority_status, incoming.get(record.canonical_key) ?? record.authority_status);
}

async function upsertCanonical(database: Database, table: string, ownerId: string, rows: Array<Record<string, unknown> & CanonicalRow>): Promise<EntityMap> {
  if (rows.length === 0) return new Map();
  await guardCanonicalAuthority(database, table, ownerId, rows);
  const data = await requireSuccess(
    database.from(table).upsert(rows.map((row) => ({ owner_id: ownerId, ...row })), { onConflict: "owner_id,canonical_key" }).select("id, canonical_key"),
    `Upsert ${table}`,
  ) as Array<{ id: string; canonical_key: string }>;
  return new Map(data.map((row) => [row.canonical_key, row.id]));
}

function requireId(map: EntityMap, key: string, label: string) {
  const id = map.get(key);
  if (!id) throw new Error(`Missing ${label} reference: ${key}`);
  return id;
}

function targetMap(entityType: CareerIntake["provenance"][number]["entityType"], maps: Record<string, EntityMap>, ownerId: string) {
  return entityType === "PROFILE" ? new Map([["PROFILE", ownerId]]) : maps[entityType];
}

async function importCareerProfile(database: Database, ownerId: string, intake: CareerIntake) {
  const existingProfile = await requireSuccess(database.from("career_profiles").select("authority_status").eq("owner_id", ownerId).maybeSingle(), "Read career profile") as { authority_status: CareerAuthority } | null;
  if (existingProfile) assertAuthorityCanReplace(existingProfile.authority_status, intake.profile.authorityStatus);
  const existingSources = await requireSuccess(database.from("career_sources").select("source_key, authority_status").eq("owner_id", ownerId), "Read career source authority") as Array<{ source_key: string; authority_status: CareerAuthority }>;
  const incomingSources = new Map(intake.sources.map((source) => [source.sourceKey, source.authorityStatus]));
  for (const source of existingSources) {
    const incoming = incomingSources.get(source.source_key);
    if (incoming) assertAuthorityCanReplace(source.authority_status, incoming);
  }

  await requireSuccess(database.from("career_sources").upsert(intake.sources.map((source) => ({
    owner_id: ownerId, source_key: source.sourceKey, label: source.label, source_kind: source.sourceKind,
    authority_status: source.authorityStatus, authority_scope: source.authorityScope,
    content_sha256: source.contentSha256, reviewed_at: source.reviewedAt,
  })), { onConflict: "owner_id,source_key" }), "Upsert career sources");
  await requireSuccess(database.from("career_profiles").upsert({
    owner_id: ownerId, full_name: intake.profile.fullName, professional_headline: intake.profile.professionalHeadline,
    location_text: intake.profile.locationText, professional_summary: intake.profile.professionalSummary,
    years_experience_claim: intake.profile.yearsExperienceClaim, authority_status: intake.profile.authorityStatus,
  }, { onConflict: "owner_id" }), "Upsert career profile");

  const organizations = await upsertCanonical(database, "career_organizations", ownerId, intake.organizations.map((value) => ({
    canonical_key: value.canonicalKey, canonical_name: value.canonicalName, organization_kind: value.organizationKind, authority_status: value.authorityStatus,
  })));
  const titles = await upsertCanonical(database, "career_titles", ownerId, intake.titles.map((value) => ({
    canonical_key: value.canonicalKey, canonical_name: value.canonicalName, authority_status: value.authorityStatus,
  })));
  const skills = await upsertCanonical(database, "career_skills", ownerId, intake.skills.map((value) => ({
    canonical_key: value.canonicalKey, canonical_name: value.canonicalName, category: value.category, authority_status: value.authorityStatus,
  })));
  const experiences = await upsertCanonical(database, "career_experiences", ownerId, intake.experiences.map((value) => ({
    canonical_key: value.canonicalKey,
    organization_id: requireId(organizations, value.organizationKey, "organization"),
    client_organization_id: value.clientOrganizationKey ? requireId(organizations, value.clientOrganizationKey, "client") : null,
    title_id: value.titleKey ? requireId(titles, value.titleKey, "title") : null,
    start_date: value.startDate, start_precision: value.startPrecision, end_date: value.endDate, end_precision: value.endPrecision,
    is_current: value.isCurrent, location_text: value.locationText, summary: value.summary,
    completeness: value.completeness, authority_status: value.authorityStatus,
  })));
  const education = await upsertCanonical(database, "career_education", ownerId, intake.education.map((value) => ({
    canonical_key: value.canonicalKey, degree_name: value.degreeName, field_of_study: value.fieldOfStudy,
    institution_name: value.institutionName, completed_on: value.completedOn, authority_status: value.authorityStatus,
  })));
  const credentials = await upsertCanonical(database, "career_credentials", ownerId, intake.credentials.map((value) => ({
    canonical_key: value.canonicalKey, credential_name: value.credentialName, credential_status: value.credentialStatus,
    issuing_organization: value.issuingOrganization, authority_status: value.authorityStatus,
  })));
  const projects = await upsertCanonical(database, "career_projects", ownerId, intake.projects.map((value) => ({
    canonical_key: value.canonicalKey, canonical_name: value.canonicalName, project_kind: value.projectKind,
    experience_id: value.experienceKey ? requireId(experiences, value.experienceKey, "experience") : null,
    client_organization_id: value.clientOrganizationKey ? requireId(organizations, value.clientOrganizationKey, "client") : null,
    summary: value.summary, business_challenge: value.businessChallenge, architecture: value.architecture, impact: value.impact,
    authority_status: value.authorityStatus,
  })));
  const accomplishments = await upsertCanonical(database, "career_accomplishments", ownerId, intake.accomplishments.map((value) => ({
    canonical_key: value.canonicalKey,
    experience_id: value.experienceKey ? requireId(experiences, value.experienceKey, "experience") : null,
    project_id: value.projectKey ? requireId(projects, value.projectKey, "project") : null,
    category: value.category, statement: value.statement, authority_status: value.authorityStatus,
  })));
  const metrics = await upsertCanonical(database, "career_metrics", ownerId, intake.metrics.map((value) => ({
    canonical_key: value.canonicalKey, accomplishment_id: requireId(accomplishments, value.accomplishmentKey, "accomplishment"),
    metric_type: value.metricType, value_numeric: value.valueNumeric, value_text: value.valueText,
    before_numeric: value.beforeNumeric, before_text: value.beforeText, after_numeric: value.afterNumeric, after_text: value.afterText,
    unit: value.unit, currency: value.currency, qualifier: value.qualifier, scope_text: value.scopeText,
    authority_status: value.authorityStatus,
  })));

  const experienceSkills = intake.experiences.flatMap((experience) => experience.skillKeys.map((skillKey) => ({
    owner_id: ownerId, experience_id: requireId(experiences, experience.canonicalKey, "experience"), skill_id: requireId(skills, skillKey, "skill"),
  })));
  if (experienceSkills.length) await requireSuccess(database.from("career_experience_skills").upsert(experienceSkills, { onConflict: "experience_id,skill_id" }), "Upsert experience skills");
  const projectSkills = intake.projects.flatMap((project) => project.skillKeys.map((skillKey) => ({
    owner_id: ownerId, project_id: requireId(projects, project.canonicalKey, "project"), skill_id: requireId(skills, skillKey, "skill"),
  })));
  if (projectSkills.length) await requireSuccess(database.from("career_project_skills").upsert(projectSkills, { onConflict: "project_id,skill_id" }), "Upsert project skills");

  const maps: Record<string, EntityMap> = {
    ORGANIZATION: organizations, TITLE: titles, EXPERIENCE: experiences, EDUCATION: education, CREDENTIAL: credentials,
    SKILL: skills, PROJECT: projects, ACCOMPLISHMENT: accomplishments, METRIC: metrics,
  };
  const existingAliases = await requireSuccess(database.from("career_aliases").select("entity_type, entity_id, alias_text").eq("owner_id", ownerId), "Read aliases") as Array<{ entity_type: string; entity_id: string; alias_text: string }>;
  const aliasKeys = new Set(existingAliases.map((value) => `${value.entity_type}:${value.entity_id}:${value.alias_text.trim().toLowerCase()}`));
  const newAliases = intake.aliases.map((alias) => {
    const id = requireId(maps[alias.entityType], alias.entityKey, "alias target");
    return { owner_id: ownerId, entity_type: alias.entityType, entity_id: id, alias_text: alias.aliasText };
  }).filter((alias) => !aliasKeys.has(`${alias.entity_type}:${alias.entity_id}:${alias.alias_text.trim().toLowerCase()}`));
  if (newAliases.length) await requireSuccess(database.from("career_aliases").insert(newAliases), "Insert career aliases");

  const sourceRows = await requireSuccess(database.from("career_sources").select("id, source_key").eq("owner_id", ownerId), "Read source identifiers") as Array<{ id: string; source_key: string }>;
  const sources = new Map(sourceRows.map((row) => [row.source_key, row.id]));
  const provenance = intake.provenance.map((fact) => ({
    owner_id: ownerId,
    source_id: requireId(sources, fact.sourceKey, "source"),
    entity_type: fact.entityType,
    entity_id: requireId(targetMap(fact.entityType, maps, ownerId), fact.entityKey, "provenance target"),
    field_name: fact.fieldName, source_page: fact.sourcePage, source_wording: fact.sourceWording,
    source_role: fact.sourceRole, resolution_note: fact.resolutionNote,
  }));
  await requireSuccess(database.from("career_provenance").upsert(provenance, { onConflict: "owner_id,source_id,entity_type,entity_id,field_name,source_page" }), "Upsert career provenance");

  return { sources: intake.sources.length, experiences: experiences.size, projects: projects.size,
    accomplishments: accomplishments.size, metrics: metrics.size, skills: skills.size, provenance: provenance.length };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: npm run career:import -- <validated-input.json>");
  const env = environmentSchema.parse(process.env);
  const intake = parseCareerIntake(JSON.parse(await readFile(inputPath, "utf8")) as unknown);
  const database = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const ownerId = await resolveOwnerId(database, env.KYM_DEV_OWNER_EMAIL);
  const counts = await importCareerProfile(database, ownerId, intake);
  console.info("Career profile import complete.", counts);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Career profile import failed.");
  process.exitCode = 1;
});
