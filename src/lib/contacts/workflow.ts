import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConfigurationError, ConflictError, NotFoundError, ProviderUnavailableError, ValidationError } from "@/lib/errors";
import {
  CONTACT_SEARCH_COOLDOWN_MINUTES,
  buildTargetRoleStrategy,
  classifyContactTitle,
  discoverContacts,
  makeManualContactDedupeKey,
  normalizeOrganizationName,
  rankContact
} from "@/lib/contacts/intelligence";
import type { ContactProviderBundle } from "@/lib/contacts/providers";

type SavedJob = { id: string; title: string; company_name: string; status: string };
type OrganizationRow = { id: string; canonical_name: string; domain: string | null; alternate_names: string[]; confidence: number; stale_at: string | null };

async function loadSavedJob(database: SupabaseClient, ownerId: string, jobId: string): Promise<SavedJob> {
  const { data, error } = await database.from("job_opportunities").select("id, title, company_name, status").eq("id", jobId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new ProviderUnavailableError("Contact intelligence is temporarily unavailable.");
  if (!data || data.status !== "SAVED") throw new NotFoundError("Saved job not found.");
  return data as SavedJob;
}

export async function ensureJobOrganization(database: SupabaseClient, ownerId: string, job: SavedJob): Promise<OrganizationRow> {
  const { data: existing, error: readError } = await database.from("job_contact_organizations").select("id, canonical_name, domain, alternate_names, confidence, stale_at").eq("owner_id", ownerId).eq("job_opportunity_id", job.id).maybeSingle();
  if (readError) throw new ProviderUnavailableError("The job organization could not be resolved.");
  const existingNames = existing ? [existing.canonical_name, ...(existing.alternate_names ?? [])].map(normalizeOrganizationName) : [];
  if (existing && !existing.stale_at && existingNames.includes(normalizeOrganizationName(job.company_name))) return existing as OrganizationRow;
  const payload = {
    owner_id: ownerId,
    job_opportunity_id: job.id,
    canonical_name: job.company_name.trim(),
    domain: null,
    alternate_names: [],
    source_type: "JOB_POSTING",
    source_provider: "job-posting",
    source_record_id: job.id,
    confidence: 65,
    resolved_at: new Date().toISOString(),
    stale_at: null
  };
  const { data, error } = await database.from("job_contact_organizations").upsert(payload, { onConflict: "owner_id,job_opportunity_id" }).select("id, canonical_name, domain, alternate_names, confidence, stale_at").single();
  if (error || !data) throw new ProviderUnavailableError("The job organization could not be resolved.");
  return data as OrganizationRow;
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isoAfterMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function startSearch(database: SupabaseClient, ownerId: string, job: SavedJob, organization: OrganizationRow, providers: ContactProviderBundle) {
  const { data: prior, error: priorError } = await database.from("job_contact_searches").select("search_version, next_search_allowed_at").eq("owner_id", ownerId).eq("job_opportunity_id", job.id).maybeSingle();
  if (priorError) throw new ProviderUnavailableError("Contact search could not be started.");
  if (prior?.next_search_allowed_at && new Date(prior.next_search_allowed_at).getTime() > Date.now()) {
    throw new ConflictError("Contact search is temporarily cached to prevent duplicate provider charges. Try again after the cooldown.");
  }
  const targetRoles = buildTargetRoleStrategy(job.title);
  const { error } = await database.from("job_contact_searches").upsert({
    owner_id: ownerId,
    job_opportunity_id: job.id,
    organization_id: organization.id,
    status: "SEARCHING",
    search_version: Number(prior?.search_version ?? 0) + 1,
    target_roles: targetRoles,
    people_provider_key: providers.people?.key ?? null,
    email_provider_key: providers.email?.key ?? null,
    verification_provider_key: providers.verification?.key ?? null,
    provider_usage: {},
    failure_code: null,
    failure_message: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    next_search_allowed_at: isoAfterMinutes(CONTACT_SEARCH_COOLDOWN_MINUTES),
    refresh_after: null
  }, { onConflict: "owner_id,job_opportunity_id" });
  if (error) throw new ProviderUnavailableError("Contact search could not be started.");
  return targetRoles;
}

async function failSearch(database: SupabaseClient, ownerId: string, jobId: string, code: string, message: string) {
  await database.from("job_contact_searches").update({ status: "FAILED", failure_code: code, failure_message: message, completed_at: new Date().toISOString(), refresh_after: isoAfterMinutes(CONTACT_SEARCH_COOLDOWN_MINUTES) }).eq("owner_id", ownerId).eq("job_opportunity_id", jobId);
}

async function insertSource(database: SupabaseClient, input: { ownerId: string; contactId: string; sourceType: string; providerKey: string; sourceRecordId: string | null; sourceUrl: string | null; fieldName: string; claim: string; confidence: number; observedAt: string }) {
  const claimFingerprint = fingerprint(`${input.sourceType}:${input.providerKey}:${input.sourceRecordId ?? ""}:${input.fieldName}:${input.claim}:${input.observedAt.slice(0, 10)}`);
  const { error } = await database.from("job_contact_sources").upsert({ owner_id: input.ownerId, contact_id: input.contactId, source_type: input.sourceType, provider_key: input.providerKey, source_record_id: input.sourceRecordId, source_url: input.sourceUrl, field_name: input.fieldName, claim_summary: input.claim, claim_fingerprint: claimFingerprint, confidence: input.confidence, observed_at: input.observedAt, is_current: true }, { onConflict: "contact_id,claim_fingerprint" });
  if (error) throw new ProviderUnavailableError("Contact provenance could not be stored.");
}

export async function runContactSearch(database: SupabaseClient, ownerId: string, jobId: string, providers: ContactProviderBundle) {
  const job = await loadSavedJob(database, ownerId, jobId);
  const organization = await ensureJobOrganization(database, ownerId, job);
  const targetRoles = await startSearch(database, ownerId, job, organization, providers);
  if (!providers.people) {
    const message = "A real people-discovery provider is not configured. Existing and manually entered contacts remain available.";
    await failSearch(database, ownerId, job.id, "PEOPLE_PROVIDER_NOT_CONFIGURED", message);
    throw new ConfigurationError(message);
  }
  try {
    const result = await discoverContacts({ organization: { canonicalName: organization.canonical_name, domain: organization.domain, alternateNames: organization.alternate_names ?? [] }, targetRoles, providers: { people: providers.people, email: providers.email, verification: providers.verification } });
    if (result.resolvedOrganization) {
      const { error: organizationError } = await database.from("job_contact_organizations").update({
        canonical_name: result.resolvedOrganization.canonicalName,
        domain: result.resolvedOrganization.domain,
        alternate_names: result.resolvedOrganization.alternateNames,
        source_type: "PEOPLE_PROVIDER",
        source_provider: result.resolvedOrganization.providerKey,
        source_record_id: result.resolvedOrganization.sourceRecordId,
        confidence: result.resolvedOrganization.confidence,
        resolved_at: new Date().toISOString(),
        stale_at: null
      }).eq("owner_id", ownerId).eq("id", organization.id);
      if (organizationError) throw new ProviderUnavailableError("The resolved organization could not be stored.");
    }
    const activeIds: string[] = [];
    for (const contact of result.contacts) {
      const { data: stored, error } = await database.from("job_contacts").upsert({
        owner_id: ownerId,
        job_opportunity_id: job.id,
        organization_id: organization.id,
        full_name: contact.fullName,
        first_name: contact.firstName,
        last_name: contact.lastName,
        current_title: contact.currentTitle,
        department: contact.department,
        seniority: contact.seniority,
        company_name: contact.companyName,
        company_domain: contact.companyDomain,
        location_text: contact.location,
        professional_profile_url: contact.professionalProfileUrl,
        source_provider: contact.providerKey,
        source_record_id: contact.sourceRecordId,
        classifications: contact.classifications,
        relevance_score: contact.relevanceScore,
        relevance_reasons: contact.relevanceReasons,
        status: "ACTIVE",
        dedupe_key: contact.dedupeKey,
        discovered_at: contact.observedAt,
        last_confirmed_at: contact.observedAt,
        stale_at: null
      }, { onConflict: "owner_id,job_opportunity_id,dedupe_key" }).select("id").single();
      if (error || !stored) throw new ProviderUnavailableError("Discovered contacts could not be stored.");
      activeIds.push(stored.id);
      await Promise.all(contact.provenance.flatMap((source) => {
        const confidence = source.providerConfidence ?? 70;
        return [
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "full_name", claim: source.fullName, confidence, observedAt: source.observedAt }),
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "current_title", claim: source.currentTitle, confidence, observedAt: source.observedAt }),
          insertSource(database, { ownerId, contactId: stored.id, sourceType: "PEOPLE_PROVIDER", providerKey: source.providerKey, sourceRecordId: source.sourceRecordId, sourceUrl: source.professionalProfileUrl, fieldName: "company_name", claim: source.companyName, confidence, observedAt: source.observedAt })
        ];
      }));
      for (const email of contact.emails) {
        const status = email.verification?.status ?? email.status;
        const { error: emailError } = await database.from("job_contact_emails").upsert({
          owner_id: ownerId,
          contact_id: stored.id,
          email_address: email.email.toLowerCase(),
          email_type: email.type,
          source_type: "EMAIL_PROVIDER",
          source_provider: email.providerKey,
          source_record_id: email.sourceRecordId,
          status,
          provider_status: email.verification?.providerStatus ?? email.providerStatus,
          verification_provider: email.verification?.providerKey ?? null,
          is_pattern_based: email.isPatternBased,
          pattern_evidence_count: email.patternEvidenceCount,
          discovered_at: email.discoveredAt,
          verified_at: email.verification?.verifiedAt ?? (status === "VERIFIED" || status === "DELIVERABLE" ? email.discoveredAt : null),
          verification_refresh_after: email.verification?.refreshAfter ?? null
        }, { onConflict: "contact_id,email_address" });
        if (emailError) throw new ProviderUnavailableError("Discovered email evidence could not be stored.");
        await insertSource(database, { ownerId, contactId: stored.id, sourceType: "EMAIL_PROVIDER", providerKey: email.providerKey, sourceRecordId: email.sourceRecordId, sourceUrl: null, fieldName: "email_address", claim: email.email, confidence: status === "VERIFIED" ? 95 : status === "DELIVERABLE" ? 90 : status === "LIKELY" ? 70 : 50, observedAt: email.discoveredAt });
        if (email.verification) {
          await insertSource(database, { ownerId, contactId: stored.id, sourceType: "VERIFICATION_PROVIDER", providerKey: email.verification.providerKey, sourceRecordId: email.sourceRecordId, sourceUrl: null, fieldName: "email_status", claim: email.verification.status, confidence: email.verification.status === "VERIFIED" || email.verification.status === "DELIVERABLE" ? 100 : 80, observedAt: email.verification.verifiedAt });
        }
      }
    }
    const refreshAfter = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const { error: completeError } = await database.from("job_contact_searches").update({ status: result.status, provider_usage: result.usage, failure_code: null, failure_message: null, completed_at: new Date().toISOString(), refresh_after: refreshAfter }).eq("owner_id", ownerId).eq("job_opportunity_id", job.id);
    if (completeError) throw new ProviderUnavailableError("Contact search status could not be stored.");
    return { status: result.status, discovered: activeIds.length };
  } catch (error) {
    await failSearch(database, ownerId, job.id, "PEOPLE_PROVIDER_UNAVAILABLE", "The contact provider is temporarily unavailable. Existing contacts were preserved.");
    if (error instanceof ProviderUnavailableError) throw error;
    throw new ProviderUnavailableError("The contact provider is temporarily unavailable. Existing contacts were preserved.");
  }
}

export async function addManualContact(database: SupabaseClient, ownerId: string, jobId: string, input: { fullName: string; currentTitle: string; department?: string | null; seniority?: string | null; location?: string | null; professionalProfileUrl?: string | null; email?: string | null; emailType?: "BUSINESS" | "PERSONAL" | "UNKNOWN" }) {
  const job = await loadSavedJob(database, ownerId, jobId);
  const organization = await ensureJobOrganization(database, ownerId, job);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const currentTitle = input.currentTitle.trim().replace(/\s+/g, " ");
  const email = input.email?.trim().toLowerCase() || null;
  const parts = fullName.split(" ");
  const targetRoles = buildTargetRoleStrategy(job.title);
  const person = {
    providerKey: "user-entered",
    sourceRecordId: randomUUID(),
    fullName,
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.at(-1) ?? null : null,
    currentTitle,
    department: input.department?.trim() || null,
    seniority: input.seniority?.trim() || null,
    companyName: organization.canonical_name,
    companyDomain: organization.domain,
    location: input.location?.trim() || null,
    professionalProfileUrl: input.professionalProfileUrl?.trim() || null,
    observedAt: new Date().toISOString(),
    providerConfidence: null
  };
  const ranking = rankContact(person, { canonicalName: organization.canonical_name, domain: organization.domain, alternateNames: organization.alternate_names }, targetRoles, email ? "UNVERIFIED" : null);
  const dedupeKey = makeManualContactDedupeKey({ fullName, companyName: organization.canonical_name, currentTitle, email });
  const { data: contact, error } = await database.from("job_contacts").upsert({
    owner_id: ownerId,
    job_opportunity_id: job.id,
    organization_id: organization.id,
    full_name: fullName,
    first_name: person.firstName,
    last_name: person.lastName,
    current_title: currentTitle,
    department: person.department,
    seniority: person.seniority,
    company_name: organization.canonical_name,
    company_domain: organization.domain,
    location_text: person.location,
    professional_profile_url: person.professionalProfileUrl,
    source_provider: "user-entered",
    source_record_id: null,
    classifications: classifyContactTitle(currentTitle, targetRoles),
    relevance_score: ranking.score,
    relevance_reasons: [...ranking.reasons, "Contact was entered by the owner and has not been provider-confirmed."],
    status: "ACTIVE",
    dedupe_key: dedupeKey,
    discovered_at: person.observedAt,
    last_confirmed_at: person.observedAt,
    stale_at: null
  }, { onConflict: "owner_id,job_opportunity_id,dedupe_key" }).select("id").single();
  if (error || !contact) throw new ProviderUnavailableError("The manual contact could not be saved.");
  await Promise.all([
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "USER_ENTERED", providerKey: "user-entered", sourceRecordId: null, sourceUrl: person.professionalProfileUrl, fieldName: "full_name", claim: fullName, confidence: 100, observedAt: person.observedAt }),
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "USER_ENTERED", providerKey: "user-entered", sourceRecordId: null, sourceUrl: person.professionalProfileUrl, fieldName: "current_title", claim: currentTitle, confidence: 100, observedAt: person.observedAt }),
    insertSource(database, { ownerId, contactId: contact.id, sourceType: "JOB_POSTING", providerKey: "job-posting", sourceRecordId: job.id, sourceUrl: null, fieldName: "company_name", claim: organization.canonical_name, confidence: organization.confidence, observedAt: person.observedAt })
  ]);
  if (email) {
    const { error: emailError } = await database.from("job_contact_emails").upsert({ owner_id: ownerId, contact_id: contact.id, email_address: email, email_type: input.emailType ?? "UNKNOWN", source_type: "USER_ENTERED", source_provider: "user-entered", source_record_id: null, status: "UNVERIFIED", provider_status: "owner-entered-unverified", verification_provider: null, is_pattern_based: false, pattern_evidence_count: 0, discovered_at: person.observedAt, verified_at: null, verification_refresh_after: null }, { onConflict: "contact_id,email_address" });
    if (emailError) throw new ValidationError("The email address could not be saved.");
  }
  return { contactId: contact.id };
}

export async function selectPreferredContact(database: SupabaseClient, ownerId: string, jobId: string, contactId: string) {
  const { error } = await database.rpc("set_preferred_job_contact", { target_job: jobId, target_contact: contactId });
  if (error) throw new NotFoundError("Contact not found.");
  const { data } = await database.from("job_contacts").select("id").eq("id", contactId).eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle();
  if (!data) throw new NotFoundError("Contact not found.");
}
