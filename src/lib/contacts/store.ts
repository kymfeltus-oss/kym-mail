import type { SupabaseClient } from "@supabase/supabase-js";
import { PERSON_DATA_FRESH_DAYS } from "@/lib/contacts/intelligence";
import type { ContactApprovalState, ContactClassification, ContactIntelligenceView as ContactView, ContactRelevanceLevel, ContactSourceType, PersonVerificationState, PostingType, TargetRole } from "@/lib/contacts/types";

type ProviderConfiguration = { people: string | null; requirement: string | null };

export async function loadContactIntelligenceView(database: SupabaseClient, ownerId: string, jobId: string, providerConfiguration: ProviderConfiguration): Promise<ContactView> {
  const [{ data: organization, error: organizationError }, { data: search, error: searchError }, { data: contacts, error: contactsError }, { data: resume, error: resumeError }] = await Promise.all([
    database.from("job_contact_organizations").select("id, canonical_name, domain, source_provider, confidence, resolved_at, stale_at").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle(),
    database.from("job_contact_searches").select("status, target_roles, search_version, failure_code, failure_message, completed_at, refresh_after, posting_type, posting_type_reasons, posting_type_evidence, pe_sponsor_name, pe_context_evidence, project_id, provider_usage").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle(),
    database.from("job_contacts").select("id, full_name, current_title, department, seniority, company_name, company_domain, location_text, professional_profile_url, classifications, relevance_score, relevance_level, relevance_reasons, approval_state, verification_state, recommendation_label, approved_at, rejected_at, project_id, research_version, status, source_provider, discovered_at, last_confirmed_at").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).neq("status", "ARCHIVED").order("approval_state").order("relevance_score", { ascending: false }).order("full_name"),
    database.from("tailored_resumes").select("current_version_id, tailored_resume_versions!tailored_resumes_current_version_fkey(id, version_number, status, project_id)").eq("owner_id", ownerId).eq("job_opportunity_id", jobId).maybeSingle()
  ]);
  if (organizationError || searchError || contactsError || resumeError) throw new Error("CONTACT_INTELLIGENCE_UNAVAILABLE");
  const contactIds = (contacts ?? []).map((item) => item.id);
  const { data: sources, error: sourceError } = contactIds.length
    ? await database.from("job_contact_sources").select("id, contact_id, source_type, provider_key, field_name, claim_summary, confidence, observed_at, source_url").eq("owner_id", ownerId).in("contact_id", contactIds).eq("is_current", true).order("observed_at", { ascending: false })
    : { data: [], error: null };
  if (sourceError) throw new Error("CONTACT_INTELLIGENCE_UNAVAILABLE");
  const resumeRelation = resume?.tailored_resume_versions;
  const currentResume = Array.isArray(resumeRelation) ? resumeRelation[0] : resumeRelation;
  const resumeContext = currentResume && ["APPROVED", "STALE"].includes(currentResume.status) ? { versionId: currentResume.id, versionNumber: currentResume.version_number, status: currentResume.status as "APPROVED" | "STALE", projectId: currentResume.project_id } : null;
  const staleCutoff = Date.now() - PERSON_DATA_FRESH_DAYS * 86_400_000;
  return {
    providerConfiguration,
    organization: organization ? { id: organization.id, canonicalName: organization.canonical_name, domain: organization.domain, sourceProvider: organization.source_provider, confidence: organization.confidence, resolvedAt: organization.resolved_at, staleAt: organization.stale_at } : null,
    search: search ? {
      status: search.status,
      targetRoles: (search.target_roles ?? []) as TargetRole[],
      searchVersion: search.search_version,
      failureCode: search.failure_code,
      failureMessage: search.failure_message,
      completedAt: search.completed_at,
      refreshAfter: search.refresh_after,
      postingType: search.posting_type as PostingType,
      postingTypeReasons: search.posting_type_reasons ?? [],
      postingTypeEvidence: search.posting_type_evidence ?? [],
      projectId: search.project_id,
      providerUsage: { requests: Number(search.provider_usage?.requests ?? 0), credits: typeof search.provider_usage?.credits === "number" ? search.provider_usage.credits : null },
      privateEquityContext: search.pe_sponsor_name ? { sponsorName: search.pe_sponsor_name, evidence: search.pe_context_evidence ?? [] } : null
    } : null,
    resumeContext,
    contacts: (contacts ?? []).map((contact) => {
      const timeStale = new Date(contact.last_confirmed_at).getTime() < staleCutoff;
      const approvalState = timeStale && contact.approval_state === "APPROVED" ? "STALE" : contact.approval_state as ContactApprovalState;
      const verificationState = timeStale ? "STALE_OR_UNCERTAIN" : contact.verification_state as PersonVerificationState;
      const classifications = (contact.classifications as string[]).filter((item) => item !== "LIKELY_HIRING_MANAGER") as ContactClassification[];
      const safeClassifications: ContactClassification[] = classifications.length ? classifications : ["OTHER_RELEVANT"];
      return {
        id: contact.id,
        fullName: contact.full_name,
        currentTitle: contact.current_title,
        department: contact.department,
        seniority: contact.seniority,
        companyName: contact.company_name,
        companyDomain: contact.company_domain,
        location: contact.location_text,
        professionalProfileUrl: contact.professional_profile_url,
        classifications: safeClassifications,
        relevanceScore: contact.relevance_score,
        relevanceReasons: contact.relevance_reasons,
        approvalState,
        verificationState,
        relevanceLevel: contact.relevance_level as ContactRelevanceLevel,
        recommendationLabel: contact.recommendation_label,
        approvedAt: contact.approved_at,
        rejectedAt: contact.rejected_at,
        projectId: contact.project_id,
        researchVersion: contact.research_version,
        status: timeStale ? "STALE" as const : contact.status,
        sourceProvider: contact.source_provider,
        discoveredAt: contact.discovered_at,
        lastConfirmedAt: contact.last_confirmed_at,
        sources: (sources ?? []).filter((item) => item.contact_id === contact.id).map((item) => ({ id: item.id, sourceType: item.source_type as ContactSourceType, providerKey: item.provider_key, fieldName: item.field_name, claimSummary: item.claim_summary, confidence: item.confidence, observedAt: item.observed_at, sourceUrl: item.source_url }))
      };
    }).sort((a, b) => (a.approvalState === "APPROVED" ? -1 : b.approvalState === "APPROVED" ? 1 : b.relevanceScore - a.relevanceScore))
  };
}
