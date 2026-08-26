alter table public.job_contact_searches
  add column project_id uuid references public.projects(id) on delete set null,
  add column posting_type text not null default 'UNKNOWN' check (posting_type in ('DIRECT_EMPLOYER', 'AGENCY_RECRUITER', 'UNKNOWN')),
  add column posting_type_reasons text[] not null default '{}',
  add column posting_type_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(posting_type_evidence) = 'array'),
  add column context_fingerprint text check (context_fingerprint is null or context_fingerprint ~ '^[a-f0-9]{64}$');

alter table public.job_contacts
  add column project_id uuid references public.projects(id) on delete set null,
  add column verification_state text not null default 'UNVERIFIED' check (verification_state in ('VERIFIED', 'LIKELY_CURRENT', 'STALE_OR_UNCERTAIN', 'UNVERIFIED')),
  add column relevance_level text not null default 'LOW' check (relevance_level in ('HIGH', 'MEDIUM', 'LOW')),
  add column approval_state text not null default 'DISCOVERED' check (approval_state in ('DISCOVERED', 'RECOMMENDED', 'APPROVED', 'REJECTED', 'STALE')),
  add column recommendation_label text not null default 'Relevant Professional' check (char_length(btrim(recommendation_label)) between 3 and 120),
  add column approved_at timestamptz,
  add column rejected_at timestamptz,
  add column research_version integer not null default 0 check (research_version >= 0),
  add constraint gate8_approval_timestamp_check check ((approval_state = 'APPROVED' and approved_at is not null and rejected_at is null) or approval_state <> 'APPROVED'),
  add constraint gate8_rejection_timestamp_check check ((approval_state = 'REJECTED' and rejected_at is not null and approved_at is null) or approval_state <> 'REJECTED');

update public.job_contacts
set approval_state = 'APPROVED', approved_at = coalesce(approved_at, updated_at)
where is_preferred and status = 'ACTIVE';

update public.job_contacts
set relevance_level = case when relevance_score >= 75 then 'HIGH' when relevance_score >= 50 then 'MEDIUM' else 'LOW' end,
    verification_state = case
      when source_provider = 'user-entered' then 'UNVERIFIED'
      when last_confirmed_at < now() - interval '90 days' then 'STALE_OR_UNCERTAIN'
      else 'LIKELY_CURRENT'
    end,
    approval_state = case when status = 'STALE' then 'STALE' else approval_state end;

create unique index job_contacts_one_approved_idx on public.job_contacts (owner_id, job_opportunity_id)
where approval_state = 'APPROVED' and status = 'ACTIVE';

create index job_contacts_gate8_rank_idx on public.job_contacts (owner_id, job_opportunity_id, approval_state, relevance_score desc);
create index job_contact_searches_context_idx on public.job_contact_searches (owner_id, context_fingerprint) where context_fingerprint is not null;

create function public.validate_gate8_contact_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.job_opportunity_projects
    where owner_id = new.owner_id and job_opportunity_id = new.job_opportunity_id and project_id = new.project_id
  ) then
    raise exception 'Hiring-intelligence Project must be associated with the saved job';
  end if;
  return new;
end;
$$;

create trigger job_contact_searches_validate_project before insert or update of project_id, job_opportunity_id, owner_id on public.job_contact_searches
for each row execute function public.validate_gate8_contact_project();
create trigger job_contacts_validate_project before insert or update of project_id, job_opportunity_id, owner_id on public.job_contacts
for each row execute function public.validate_gate8_contact_project();

create function public.approve_job_contact(target_job uuid, target_contact uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare contact_owner uuid; contact_status public.contact_record_status;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select owner_id, status into contact_owner, contact_status from public.job_contacts
  where id = target_contact and job_opportunity_id = target_job;
  if contact_owner is null or contact_owner <> auth.uid() or contact_status <> 'ACTIVE' then raise exception 'Current contact not found'; end if;
  update public.job_contacts
  set approval_state = case when approval_state = 'APPROVED' then 'RECOMMENDED' else approval_state end,
      approved_at = null,
      is_preferred = false
  where owner_id = auth.uid() and job_opportunity_id = target_job and approval_state = 'APPROVED';
  update public.job_contacts
  set approval_state = 'APPROVED', approved_at = now(), rejected_at = null, is_preferred = true
  where id = target_contact and owner_id = auth.uid();
end;
$$;

create function public.reject_job_contact(target_job uuid, target_contact uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare contact_owner uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select owner_id into contact_owner from public.job_contacts where id = target_contact and job_opportunity_id = target_job;
  if contact_owner is null or contact_owner <> auth.uid() then raise exception 'Contact not found'; end if;
  update public.job_contacts
  set approval_state = 'REJECTED', rejected_at = now(), approved_at = null, is_preferred = false
  where id = target_contact and owner_id = auth.uid();
end;
$$;

create or replace function public.mark_contact_intelligence_stale_from_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.company_name is distinct from new.company_name then
    update public.job_contact_organizations set stale_at = coalesce(stale_at, now()), updated_at = now() where job_opportunity_id = new.id;
  end if;
  update public.job_contact_searches set status = 'STALE', refresh_after = now(), updated_at = now() where job_opportunity_id = new.id;
  update public.job_contacts
  set status = 'STALE', stale_at = coalesce(stale_at, now()), verification_state = 'STALE_OR_UNCERTAIN',
      approval_state = case when approval_state = 'APPROVED' then 'STALE' else approval_state end,
      is_preferred = false, updated_at = now()
  where job_opportunity_id = new.id and status = 'ACTIVE';
  return new;
end;
$$;

drop trigger if exists job_opportunities_stale_contact_intelligence on public.job_opportunities;
create trigger job_opportunities_stale_contact_intelligence
after update of company_name, title, description_text, source_url, application_url, provider_metadata on public.job_opportunities
for each row when (
  old.company_name is distinct from new.company_name or old.title is distinct from new.title or
  old.description_text is distinct from new.description_text or old.source_url is distinct from new.source_url or
  old.application_url is distinct from new.application_url or old.provider_metadata is distinct from new.provider_metadata
) execute function public.mark_contact_intelligence_stale_from_job();

revoke all on function public.validate_gate8_contact_project() from public, anon, authenticated;
revoke all on function public.set_preferred_job_contact(uuid, uuid) from authenticated;
revoke all on function public.approve_job_contact(uuid, uuid) from public, anon;
revoke all on function public.reject_job_contact(uuid, uuid) from public, anon;
grant execute on function public.approve_job_contact(uuid, uuid), public.reject_job_contact(uuid, uuid) to authenticated;
