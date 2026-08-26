import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConfigurationError, ConflictError, NotFoundError, ProviderUnavailableError } from "@/lib/errors";
import {
  CONTACT_SEARCH_COOLDOWN_MINUTES,
  PERSON_DATA_FRESH_DAYS,
  buildTargetRoleStrategy,
  classifyContactTitle,
  classifyPostingType,
  discoverRelevantPeople,
  makeManualContactDedupeKey,
  normalizeOrganizationName,
  rankContact
} from "@/lib/contacts/intelligence";
import type { ContactProviderBundle } from "@/lib/contacts/providers";

type SavedJob = {
  id: string;
  title: string;
  company_name: string;
  description_text: string | null;
  source_name: string | null;
  source_url: string | null;
  application_url: string | null;
  provider_metadata: Record<string, unknown> | null;
  status: string;
};
type OrganizationRow = { id: string; canonical_name: string; domain: string | null; alternate_names: string[]; confidence: number; stale_at: string | null };

async function loadSavedJob(database: SupabaseClient, ownerId: string, jobId: string): Promise<SavedJob> {
  const { data, error } = await database.from("job_opportunities").select("id, title, company_name, description_text, source_name, source_url, application_url, provider_metadata, status").eq("id", jobId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new ProviderUnavailableError("Hiring intelligence is temporarily unavailable.");
  if (!data || data.status !== "SAVED") throw new NotFoundError("Saved job not found.");
  return data as SavedJob;
}

async function resolveProjectId(database: SupabaseClient, ownerId: string, jobId: string, requested?: string | null) {
  let query = database.from("job_opportunity_projects").select("project_id").eq("owner_id", ownerId).eq("job_opportunity_id", jobId);
  if (requested) query = query.eq("project_id", requested);
  const { data, error } = await query.order("associated_at").limit(1).maybeSingle();
  if (error) throw new ProviderUnavailableError("The Job Project association could not be loaded.");
  if (requested && !data) throw new NotFoundError("Project association not found.");
  return data?.project_id ?? null;
}

export async function ensureJobOrganization(database: SupabaseClient, ownerId: string, job: SavedJob): Promise<OrganizationRow> {
  const { data: existing, error: readError } = await database.from("job_contact_organizations").select("id, canonical_name, domain, alternate_names, confidence, stale_at").eq("owner_id", ownerId).eq("job_opportunity_id", job.id).maybeSingle();
  if (readError) throw new ProviderUnavailableError("The posting organization could not be resolved.");
  const existingNames = existing ? [existing.canonical_name, ...(existing.alternate_names ?? [])].map(normalizeOrganizationName) : [];
  if (existing && !existing.stale_at && existingNames.includes(normalizeOrganizationName(job.company_name))) return existing as OrganizationRow;
  const { data, error } = await database.from("job_contact_organizations").upsert({ owner_id: ownerId, job_opportunity_id: job.id, canonical_name: job.company_name.trim(), domain: null, alternate_names: [], source_type: "JOB_POSTING", source_provider: "job-posting", source_record_id: job.id, confidence: 65, resolved_at: new Date().toISOString(), stale_at: null }, { onConflict: "owner_id,job_opportunity_id" }).select("id, canonical_name, domain, alternate_names, confidence, stale_at").single();
  if (error || !data) throw new ProviderUnavailableError("The posting organization could not be resolved.");
  return data as OrganizationRow;
}

function fingerprint(value: string) { return createHash("sha256").update(value).digest("hex"); }
function isoAfterMinutes(minutes: number) { return new Date(Date.now() + minutes * 60_000).toISOString(); }

async function startSearch(database: SupabaseClient, ownerId: string, job: SavedJob, organization: OrganizationRow, providers: ContactProviderBundle, projectId: string | null) {
  const posting = classifyPostingType({ title: job.title, companyName: job.company_name, description: job.description_text, sourceName: job.source_name, sourceUrl: job.source_url, applicationUrl: job.application_url, providerMetadata: job.provider_metadata });
  const targetRoles = buildTargetRoleStrategy(job.title, posting.type, job.description_text ?? "");
  const contextFingerprint = fingerprint(JSON.stringify({ job: job.id, company: job.company_name, title: job.title, description: job.description_text, posting, targetRoles }));
  const { data: prior, error: priorError } = await database.from("job_contact_searches").select("search_version, next_search_allowed_at, context_fingerprint").eq("owner_id", ownerId).eq("job_opportunity_id", job.id).maybeSingle();
  if (priorError) throw new ProviderUnavailableError("People research could not be started.");
  if (prior?.next_search_allowed_at && new Date(prior.next_search_allowed_at).getTime() > Date.now() && prior.context_fingerprint === contextFingerprint) throw new ConflictError("Research is cached to prevent duplicate provider charges. Use the existing shortlist until the cooldown ends.");
  const searchVersion = Number(prior?.search_version ?? 0) + 1;
  const { error } = await database.from("job_contact_searches").upsert({
    owner_id: ownerId,
    job_opportunity_id: job.id,
    organization_id: organization.id,
    project_id: projectId,
    status: "SEARCHING",
    search_version: searchVersion,
    target_roles: targetRoles,
    posting_type: posting.type,
    posting_type_reasons: posting.reasons,
    posting_type_evidence: posting.evidence,
    context_fingerprint: contextFingerprint,
    people_provider_key: providers.people?.key ?? null,
    email_provider_key: null,
    verification_provider_key: null,
    provider_usage: {},
    failure_code: null,
    failure_message: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    next_search_allowed_at: isoAfterMinutes(CONTACT_SEARCH_COOLDOWN_MINUTES),
    refresh_after: null
  }, { onConflict: "owner_id,job_opportunity_id" });
  if (error) throw new ProviderUnavailableError("People research could not be started.");
  return { targetRoles, posting, searchVersion };
}

async function failSearch(database: SupabaseClient, ownerId: string, jobId: string, code: string, message: string) {
  await database.from("job_contact_searches").update({ status: "FAILED", failure_code: code, failure_message: message, completed_at: new Date().toISOString(), refresh_after: isoAfterMinutes(CONTACT_SEARCH_COOLDOWN_MINUTES) }).eq("owner_id", ownerId).eq("job_opportunity_id", jobId);
}

async function insertSource(database: SupabaseClient, input: { ownerId: string; contactId: string; sourceType: string; providerKey: string; sourceRecordId: string | null; sourceUrl: string | null; fieldName: string; claim: string; confidence: number; observedAt: string }) {
  const claimFingerprint = fingerprint(`${input.sourceType}:${input.providerKey}:${input.sourceRecordId ?? ""}:${input.fieldName}:${input.claim}:${input.observedAt.slice(0, 10)}`);
  const { error } = await database.from("job_contact_sources").upsert({ owner_id: input.ownerId, contact_id: input.contactId, source_type: input.sourceType, provider_key: input.providerKey, source_record_id: input.sourceRecordId, source_url: input.sourceUrl, field_name: input.fieldName, claim_summary: input.claim, claim_fingerprint: claimFingerprint, confidence: input.confidence, observed_at: input.observedAt, is_current: true }, { onConflict: "contact_id,claim_fingerprint" });
  if (error) throw new ProviderUnavailableError("Contact evidence could not be stored.");
}

export async function runContactSearch(database: SupabaseClient, ownerId: string, jobId: string, providers: ContactProviderBundle, requestedProjectId?: string | null) {
  const job = await loadSavedJob(database, ownerId, jobId);
  const projectId = await resolveProjectId(database, ownerId, job.id, requestedProjectId);
  const organization = await ensureJobOrganization(database, ownerId, job);
  const { targetRoles, posting, searchVersion } = await startSearch(database, ownerId, job, organization, providers, projectId);
  if (!providers.people) {
    const message = "People research is not configured. Set server-only APOLLO_API_KEY with organization enrichment, People API Search, and People Enrichment access. Existing and manually entered people remain available.";
    await failSearch(database, ownerId, job.id, "PEOPLE_PROVIDER_NOT_CONFIGURED", message);
    throw new ConfigurationError(message);
  }
  try {
    const result = await discoverRelevantPeople({ organization: { canonicalName: organization.canonical_name, domain: organization.domain, alternateNames: organization.alternate_names ?? [] }, targetRoles, postingType: posting.type, people: providers.people });
    if (result.resolvedOrganization) {
      const { error } = await database.from("job_contact_organizations").update({ canonical_name: result.resolvedOrganization.canonicalName, domain: result.resolvedOrganization.domain, alternate_names: result.resolvedOrganization.alternateNames, source_type: "PEOPLE_PROVIDER", source_provider: result.resolvedOrganization.providerKey, source_record_id: result.resolvedOrganization.sourceRecordId, confidence: result.resolvedOrganization.confidence, resolved_at: new Date().toISOString(), stale_at: null }).eq("owner_id", ownerId).eq("id", organization.id);
      if (error) throw new ProviderUnavailableError("The resolved organization could not be stored.");
    }
    const activeIds: string[] = [];
    for (let index = 0; index < result.contacts.length; index++) {
      const contact = result.contacts[index];
      const { data: stored, error } = await database.from("job_contacts").upsert({
        owner_id: ownerId, job_opportunity_id: job.id, organization_id: organization.id, project_id: projectId,
        full_name: contact.fullName, first_name: contact.firstName, last_name: contact.lastName, current_title: contact.currentTitle,
        department: contact.department, seniority: contact.seniority, company_name: contact.companyName, company_domain: contact.companyDomain,
        location_text: contact.location, professional_profile_url: contact.professionalProfileUrl, source_provider: contact.providerKey,
        source_record_id: contact.sourceRecordId, classifications: contact.classifications, relevance_score: contact.relevanceScore,
        relevance_level: contact.relevanceLevel, relevance_reasons: contact.relevanceReasons, verification_state: contact.verificationState,
        recommendation_label: contact.recommendationLabel, research_version: searchVersion,
        approval_state: index === 0 ? "RECOMMENDED" : "DISCOVERED", status: "ACTIVE", dedupe_key: contact.dedupeKey,
        discovered_at: contact.observedAt, last_confirmed_at: contact.observedAt, stale_at: null
      }, { onConflict: "owner_id,job_opportunity_id,dedupe_key" }).select("id").single();
      if (error || !stored) throw new ProviderUnavailableError("Discovered people could not be stored.");
      activeIds.push(stored.id);
      for (const source of contact.provenance) {
        const confidence = source.providerConfidence ?? 70;
        await Promise.all([
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "full_name", claim: source.fullName, confidence, observedAt: source.observedAt }),
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "current_title", claim: source.currentTitle, confidence, observedAt: source.observedAt }),
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "company_name", claim: source.companyName, confidence, observedAt: source.observedAt })
        ]);
      }
    }
    const refreshAfter = new Date(Date.now() + PERSON_DATA_FRESH_DAYS * 86_400_000).toISOString();
    const { error } = await database.from("job_contact_searches").update({ status: "COMPLETE", provider_usage: result.usage, failure_code: null, failure_message: null, completed_at: new Date().toISOString(), refresh_after: refreshAfter }).eq("owner_id", ownerId).eq("job_opportunity_id", job.id);
    if (error) throw new ProviderUnavailableError("Research status could not be stored.");
    return { status: "COMPLETE" as const, discovered: activeIds.length, postingType: posting.type, providerCalls: result.usage.requests, credits: result.usage.credits };
  } catch (error) {
    await failSearch(database, ownerId, job.id, "PEOPLE_PROVIDER_UNAVAILABLE", "The people provider is temporarily unavailable. Existing research was preserved.");
    if (error instanceof ProviderUnavailableError || error instanceof ConfigurationError) throw error;
    throw new ProviderUnavailableError("The people provider is temporarily unavailable. Existing research was preserved.");
  }
}

export async function addManualContact(database: SupabaseClient, ownerId: string, jobId: string, input: { fullName: string; currentTitle: string; department?: string | null; seniority?: string | null; location?: string | null; professionalProfileUrl?: string | null; evidenceUrl?: string | null; projectId?: string | null }) {
  const job = await loadSavedJob(database, ownerId, jobId);
  const projectId = await resolveProjectId(database, ownerId, job.id, input.projectId);
  const organization = await ensureJobOrganization(database, ownerId, job);
  const posting = classifyPostingType({ title: job.title, companyName: job.company_name, description: job.description_text, sourceName: job.source_name, sourceUrl: job.source_url, applicationUrl: job.application_url, providerMetadata: job.provider_metadata });
  const targetRoles = buildTargetRoleStrategy(job.title, posting.type, job.description_text ?? "");
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const currentTitle = input.currentTitle.trim().replace(/\s+/g, " ");
  const parts = fullName.split(" ");
  const now = new Date().toISOString();
  const person = { providerKey: "user-entered", sourceRecordId: randomUUID(), fullName, firstName: parts[0] ?? null, lastName: parts.length > 1 ? parts.at(-1) ?? null : null, currentTitle, department: input.department?.trim() || null, seniority: input.seniority?.trim() || null, companyName: organization.canonical_name, companyDomain: organization.domain, location: input.location?.trim() || null, professionalProfileUrl: input.professionalProfileUrl?.trim() || null, observedAt: now, providerConfidence: null };
  const ranking = rankContact(person, { canonicalName: organization.canonical_name, domain: organization.domain, alternateNames: organization.alternate_names }, targetRoles, posting.type);
  const dedupeKey = makeManualContactDedupeKey({ fullName, companyName: organization.canonical_name, currentTitle });
  const { data: contact, error } = await database.from("job_contacts").upsert({ owner_id: ownerId, job_opportunity_id: job.id, organization_id: organization.id, project_id: projectId, full_name: fullName, first_name: person.firstName, last_name: person.lastName, current_title: currentTitle, department: person.department, seniority: person.seniority, company_name: organization.canonical_name, company_domain: organization.domain, location_text: person.location, professional_profile_url: person.professionalProfileUrl, source_provider: "user-entered", source_record_id: null, classifications: classifyContactTitle(currentTitle, targetRoles), relevance_score: ranking.score, relevance_level: ranking.relevanceLevel, relevance_reasons: [...ranking.reasons, "This person was entered by the owner; identity and current employment are not provider-verified."], verification_state: "UNVERIFIED", recommendation_label: ranking.recommendationLabel, approval_state: "DISCOVERED", research_version: 0, status: "ACTIVE", dedupe_key: dedupeKey, discovered_at: now, last_confirmed_at: now, stale_at: null }, { onConflict: "owner_id,job_opportunity_id,dedupe_key" }).select("id").single();
  if (error || !contact) throw new ProviderUnavailableError("The manual person could not be saved.");
  const evidenceUrl = input.evidenceUrl?.trim() || input.professionalProfileUrl?.trim() || null;
  await Promise.all([
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "USER_ENTERED", providerKey: "user-entered", sourceRecordId: null, sourceUrl: evidenceUrl, fieldName: "full_name", claim: fullName, confidence: 50, observedAt: now }),
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "USER_ENTERED", providerKey: "user-entered", sourceRecordId: null, sourceUrl: evidenceUrl, fieldName: "current_title", claim: currentTitle, confidence: 50, observedAt: now }),
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "JOB_POSTING", providerKey: "job-posting", sourceRecordId: job.id, sourceUrl: job.source_url, fieldName: "company_name", claim: organization.canonical_name, confidence: organization.confidence, observedAt: now })
  ]);
  return { contactId: contact.id };
}

export async function approveContact(database: SupabaseClient, ownerId: string, jobId: string, contactId: string) {
  const { error } = await database.rpc("approve_job_contact", { target_job: jobId, target_contact: contactId });
  if (error) throw new ConflictError("Only a current, owner-visible person can be approved.");
  const { data } = await database.from("job_contacts").select("id").eq("id", contactId).eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle();
  if (!data) throw new NotFoundError("Person not found.");
}

export async function rejectContact(database: SupabaseClient, ownerId: string, jobId: string, contactId: string) {
  const { error } = await database.rpc("reject_job_contact", { target_job: jobId, target_contact: contactId });
  if (error) throw new NotFoundError("Person not found.");
  const { data } = await database.from("job_contacts").select("id").eq("id", contactId).eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle();
  if (!data) throw new NotFoundError("Person not found.");
}
