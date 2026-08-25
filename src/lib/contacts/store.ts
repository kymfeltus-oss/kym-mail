import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactIntelligenceView as ContactView, ContactClassification, ContactEmailStatus, ContactSourceType, TargetRole } from "@/lib/contacts/types";

type ProviderConfiguration = { people: string | null; email: string | null; verification: string | null };

export async function loadContactIntelligenceView(database: SupabaseClient, ownerId: string, jobId: string, providerConfiguration: ProviderConfiguration): Promise<ContactView> {
  const [{ data: organization, error: organizationError }, { data: search, error: searchError }, { data: contacts, error: contactsError }] = await Promise.all([
    database.from("job_contact_organizations").select("id, canonical_name, domain, source_provider, confidence, resolved_at, stale_at").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle(),
    database.from("job_contact_searches").select("status, target_roles, search_version, failure_code, failure_message, completed_at, refresh_after").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle(),
    database.from("job_contacts").select("id, full_name, current_title, department, seniority, company_name, company_domain, location_text, professional_profile_url, classifications, relevance_score, relevance_reasons, is_preferred, status, source_provider, discovered_at, last_confirmed_at").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).neq("status", "ARCHIVED").order("is_preferred", { ascending: false }).order("relevance_score", { ascending: false }).order("full_name")
  ]);
  if (organizationError || searchError || contactsError) throw new Error("CONTACT_INTELLIGENCE_UNAVAILABLE");
  const contactIds = (contacts ?? []).map((item) => item.id);
  const [{ data: emails, error: emailError }, { data: sources, error: sourceError }] = contactIds.length ? await Promise.all([
    database.from("job_contact_emails").select("id, contact_id, email_address, email_type, status, source_provider, is_pattern_based, verified_at").eq("owner_id", ownerId).in("contact_id", contactIds).order("verified_at", { ascending: false, nullsFirst: false }),
    database.from("job_contact_sources").select("id, contact_id, source_type, provider_key, field_name, claim_summary, confidence, observed_at, source_url").eq("owner_id", ownerId).in("contact_id", contactIds).eq("is_current", true).order("observed_at", { ascending: false })
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (emailError || sourceError) throw new Error("CONTACT_INTELLIGENCE_UNAVAILABLE");
  return {
    providerConfiguration,
    organization: organization ? { id: organization.id, canonicalName: organization.canonical_name, domain: organization.domain, sourceProvider: organization.source_provider, confidence: organization.confidence, resolvedAt: organization.resolved_at, staleAt: organization.stale_at } : null,
    search: search ? { status: search.status, targetRoles: (search.target_roles ?? []) as TargetRole[], searchVersion: search.search_version, failureCode: search.failure_code, failureMessage: search.failure_message, completedAt: search.completed_at, refreshAfter: search.refresh_after } : null,
    contacts: (contacts ?? []).map((contact) => ({
      id: contact.id,
      fullName: contact.full_name,
      currentTitle: contact.current_title,
      department: contact.department,
      seniority: contact.seniority,
      companyName: contact.company_name,
      companyDomain: contact.company_domain,
      location: contact.location_text,
      professionalProfileUrl: contact.professional_profile_url,
      classifications: contact.classifications as ContactClassification[],
      relevanceScore: contact.relevance_score,
      relevanceReasons: contact.relevance_reasons,
      isPreferred: contact.is_preferred,
      status: contact.status,
      sourceProvider: contact.source_provider,
      discoveredAt: contact.discovered_at,
      lastConfirmedAt: contact.last_confirmed_at,
      emails: (emails ?? []).filter((item) => item.contact_id === contact.id).map((item) => ({ id: item.id, email: item.email_address, type: item.email_type, status: item.status as ContactEmailStatus, sourceProvider: item.source_provider, isPatternBased: item.is_pattern_based, verifiedAt: item.verified_at })),
      sources: (sources ?? []).filter((item) => item.contact_id === contact.id).map((item) => ({ id: item.id, sourceType: item.source_type as ContactSourceType, providerKey: item.provider_key, fieldName: item.field_name, claimSummary: item.claim_summary, confidence: item.confidence, observedAt: item.observed_at, sourceUrl: item.source_url }))
    }))
  };
}
