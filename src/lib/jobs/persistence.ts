import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedJob } from "@/domain/providers/job-search-provider";
import { NotFoundError, ProviderUnavailableError, ValidationError } from "@/lib/errors";

export function jobOpportunityValues(ownerId: string, job: NormalizedJob) {
  return {
    owner_id: ownerId,
    provider: job.provider,
    provider_job_id: job.providerJobId,
    title: job.title,
    company_name: job.companyName,
    company_identifier: job.companyIdentifier,
    location_text: job.locationText,
    work_arrangement: job.workArrangement,
    employment_types: job.employmentTypes,
    salary_minimum: job.salaryMinimum,
    salary_maximum: job.salaryMaximum,
    salary_currency: job.salaryCurrency,
    salary_period: job.salaryPeriod,
    description_text: job.descriptionText,
    posted_at: job.postedAt,
    source_name: job.sourceName,
    source_url: job.sourceUrl,
    application_url: job.applicationUrl,
    provider_metadata: job.providerMetadata,
    discovered_at: job.discoveredAt,
    saved_at: new Date().toISOString(),
    status: "SAVED"
  };
}

async function findAvailableProject(database: SupabaseClient, ownerId: string, projectId: string) {
  const { data, error } = await database.from("projects").select("id").eq("id", projectId).eq("owner_id", ownerId).eq("type", "JOB_SEARCH").neq("status", "ARCHIVED").maybeSingle();
  if (error) throw new ProviderUnavailableError("The Project could not be checked.");
  if (!data) throw new ValidationError("Select an available Job Search Project.");
  return data;
}

export async function saveJobOpportunity(database: SupabaseClient, ownerId: string, job: NormalizedJob, projectId: string | null) {
  if (projectId) await findAvailableProject(database, ownerId, projectId);
  const values = jobOpportunityValues(ownerId, job);
  const { data: existing, error: existingError } = await database.from("job_opportunities").select("id").eq("owner_id", ownerId).eq("provider", job.provider).eq("provider_job_id", job.providerJobId).maybeSingle();
  if (existingError) throw new ProviderUnavailableError("The job could not be saved.");

  let jobId = existing?.id as string | undefined;
  if (jobId) {
    const { error } = await database.from("job_opportunities").update(values).eq("id", jobId).eq("owner_id", ownerId);
    if (error) throw new ProviderUnavailableError("The job could not be saved.");
  } else {
    const { data, error } = await database.from("job_opportunities").insert(values).select("id").single();
    if (error?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await database.from("job_opportunities").select("id").eq("owner_id", ownerId).eq("source_url", job.sourceUrl).maybeSingle();
      if (duplicateError || !duplicate) throw new ProviderUnavailableError("The job could not be saved.");
      jobId = duplicate.id;
      const { error: updateError } = await database.from("job_opportunities").update(values).eq("id", jobId).eq("owner_id", ownerId);
      if (updateError) throw new ProviderUnavailableError("The job could not be saved.");
    } else if (error || !data) throw new ProviderUnavailableError("The job could not be saved.");
    else jobId = data.id;
  }

  if (projectId) {
    const { error } = await database.from("job_opportunity_projects").upsert({ owner_id: ownerId, job_opportunity_id: jobId, project_id: projectId }, { onConflict: "job_opportunity_id,project_id", ignoreDuplicates: true });
    if (error) throw new ProviderUnavailableError("The job was saved, but its Project could not be associated.");
  }
  return jobId;
}

export async function setJobOpportunityProjects(database: SupabaseClient, ownerId: string, jobId: string, projectIds: string[]) {
  const { data: job, error: jobError } = await database.from("job_opportunities").select("id").eq("id", jobId).eq("owner_id", ownerId).maybeSingle();
  if (jobError) throw new ProviderUnavailableError("The saved job could not be checked.");
  if (!job) throw new NotFoundError("Saved job not found.");

  const uniqueIds = [...new Set(projectIds)];
  if (uniqueIds.length) {
    const { data: projects, error } = await database.from("projects").select("id").eq("owner_id", ownerId).eq("type", "JOB_SEARCH").neq("status", "ARCHIVED").in("id", uniqueIds);
    if (error) throw new ProviderUnavailableError("The Projects could not be checked.");
    if ((projects ?? []).length !== uniqueIds.length) throw new ValidationError("One or more selected Projects are unavailable.");
  }

  const { data: current, error: currentError } = await database.from("job_opportunity_projects").select("project_id").eq("owner_id", ownerId).eq("job_opportunity_id", jobId);
  if (currentError) throw new ProviderUnavailableError("Project associations could not be loaded.");
  const currentIds = new Set((current ?? []).map((item) => item.project_id));
  const removeIds = [...currentIds].filter((id) => !uniqueIds.includes(id));
  const addIds = uniqueIds.filter((id) => !currentIds.has(id));
  if (removeIds.length) {
    const { error } = await database.from("job_opportunity_projects").delete().eq("owner_id", ownerId).eq("job_opportunity_id", jobId).in("project_id", removeIds);
    if (error) throw new ProviderUnavailableError("Project associations could not be updated.");
  }
  if (addIds.length) {
    const { error } = await database.from("job_opportunity_projects").insert(addIds.map((projectId) => ({ owner_id: ownerId, job_opportunity_id: jobId, project_id: projectId })));
    if (error) throw new ProviderUnavailableError("Project associations could not be updated.");
  }
}
