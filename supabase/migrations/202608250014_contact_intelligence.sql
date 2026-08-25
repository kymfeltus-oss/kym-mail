create type public.contact_search_status as enum ('NOT_SEARCHED', 'SEARCHING', 'COMPLETE', 'PARTIAL', 'FAILED', 'STALE');
create type public.contact_record_status as enum ('ACTIVE', 'STALE', 'ARCHIVED');
create type public.contact_classification as enum (
  'LIKELY_HIRING_MANAGER', 'FUNCTIONAL_LEADER', 'EXECUTIVE_SPONSOR',
  'ACCOUNTING_LEADER', 'FINANCE_LEADER', 'SYSTEMS_LEADER',
  'RECRUITER', 'TALENT_ACQUISITION', 'OTHER_RELEVANT'
);
create type public.contact_source_type as enum (
  'PEOPLE_PROVIDER', 'EMAIL_PROVIDER', 'VERIFICATION_PROVIDER', 'JOB_POSTING', 'USER_ENTERED'
);
create type public.contact_email_status as enum ('VERIFIED', 'DELIVERABLE', 'LIKELY', 'UNVERIFIED', 'RISKY', 'INVALID', 'NOT_FOUND');
create type public.contact_email_type as enum ('BUSINESS', 'PERSONAL', 'UNKNOWN');

create table public.job_contact_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  canonical_name text not null check (char_length(btrim(canonical_name)) between 2 and 200),
  domain text check (domain is null or domain = lower(domain) and domain ~ '^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$'),
  alternate_names text[] not null default '{}',
  source_type public.contact_source_type not null,
  source_provider text not null check (source_provider ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  source_record_id text check (source_record_id is null or char_length(source_record_id) between 1 and 200),
  confidence smallint not null check (confidence between 0 and 100),
  resolved_at timestamptz not null default now(),
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, job_opportunity_id)
);

create table public.job_contact_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  organization_id uuid not null references public.job_contact_organizations(id) on delete cascade,
  status public.contact_search_status not null default 'NOT_SEARCHED',
  search_version integer not null default 1 check (search_version > 0),
  target_roles jsonb not null default '[]'::jsonb check (jsonb_typeof(target_roles) = 'array'),
  people_provider_key text check (people_provider_key is null or people_provider_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  email_provider_key text check (email_provider_key is null or email_provider_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  verification_provider_key text check (verification_provider_key is null or verification_provider_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  provider_usage jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_usage) = 'object'),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  failure_message text check (failure_message is null or char_length(btrim(failure_message)) between 3 and 500),
  started_at timestamptz,
  completed_at timestamptz,
  next_search_allowed_at timestamptz,
  refresh_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, job_opportunity_id),
  check ((status = 'SEARCHING' and started_at is not null) or status <> 'SEARCHING'),
  check ((status = 'FAILED' and failure_code is not null and failure_message is not null) or status <> 'FAILED')
);

create table public.job_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  organization_id uuid not null references public.job_contact_organizations(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  first_name text check (first_name is null or char_length(btrim(first_name)) between 1 and 80),
  last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 80),
  current_title text not null check (char_length(btrim(current_title)) between 2 and 200),
  department text check (department is null or char_length(btrim(department)) between 2 and 120),
  seniority text check (seniority is null or char_length(btrim(seniority)) between 2 and 80),
  company_name text not null check (char_length(btrim(company_name)) between 2 and 200),
  company_domain text check (company_domain is null or company_domain = lower(company_domain) and company_domain ~ '^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$'),
  location_text text check (location_text is null or char_length(btrim(location_text)) between 2 and 200),
  professional_profile_url text check (professional_profile_url is null or professional_profile_url ~ '^https://'),
  source_provider text not null check (source_provider ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  source_record_id text check (source_record_id is null or char_length(source_record_id) between 1 and 200),
  classifications public.contact_classification[] not null check (cardinality(classifications) > 0),
  relevance_score smallint not null check (relevance_score between 0 and 100),
  relevance_reasons text[] not null check (cardinality(relevance_reasons) > 0),
  is_preferred boolean not null default false,
  status public.contact_record_status not null default 'ACTIVE',
  dedupe_key text not null check (dedupe_key ~ '^[a-f0-9]{64}$'),
  discovered_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, job_opportunity_id, dedupe_key)
);

create unique index job_contacts_one_preferred_idx on public.job_contacts (owner_id, job_opportunity_id)
where is_preferred and status = 'ACTIVE';

create table public.job_contact_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.job_contacts(id) on delete cascade,
  source_type public.contact_source_type not null,
  provider_key text not null check (provider_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  source_record_id text check (source_record_id is null or char_length(source_record_id) between 1 and 200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]{1,79}$'),
  claim_summary text not null check (char_length(btrim(claim_summary)) between 2 and 500),
  claim_fingerprint text not null check (claim_fingerprint ~ '^[a-f0-9]{64}$'),
  confidence smallint not null check (confidence between 0 and 100),
  observed_at timestamptz not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (contact_id, claim_fingerprint)
);

create table public.job_contact_emails (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.job_contacts(id) on delete cascade,
  email_address text not null check (email_address = lower(email_address) and email_address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  email_type public.contact_email_type not null default 'BUSINESS',
  source_type public.contact_source_type not null,
  source_provider text not null check (source_provider ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  source_record_id text check (source_record_id is null or char_length(source_record_id) between 1 and 200),
  status public.contact_email_status not null,
  provider_status text check (provider_status is null or char_length(provider_status) between 1 and 120),
  verification_provider text check (verification_provider is null or verification_provider ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  is_pattern_based boolean not null default false,
  pattern_evidence_count smallint not null default 0 check (pattern_evidence_count between 0 and 100),
  discovered_at timestamptz not null default now(),
  verified_at timestamptz,
  verification_refresh_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, email_address),
  check (not is_pattern_based or status in ('LIKELY', 'UNVERIFIED', 'RISKY', 'INVALID')),
  check (not is_pattern_based or pattern_evidence_count >= 2),
  check (status not in ('VERIFIED', 'DELIVERABLE') or verified_at is not null)
);

create index job_contact_searches_job_idx on public.job_contact_searches (owner_id, job_opportunity_id);
create index job_contacts_job_rank_idx on public.job_contacts (owner_id, job_opportunity_id, status, relevance_score desc);
create index job_contact_sources_contact_idx on public.job_contact_sources (owner_id, contact_id, observed_at desc);
create index job_contact_emails_contact_idx on public.job_contact_emails (owner_id, contact_id, status);

create function public.touch_contact_intelligence_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger job_contact_organizations_touch before update on public.job_contact_organizations
for each row execute function public.touch_contact_intelligence_updated_at();
create trigger job_contact_searches_touch before update on public.job_contact_searches
for each row execute function public.touch_contact_intelligence_updated_at();
create trigger job_contacts_touch before update on public.job_contacts
for each row execute function public.touch_contact_intelligence_updated_at();
create trigger job_contact_emails_touch before update on public.job_contact_emails
for each row execute function public.touch_contact_intelligence_updated_at();

create function public.validate_contact_intelligence_owner()
returns trigger language plpgsql set search_path = '' as $$
declare
  job_owner uuid;
  organization_owner uuid;
  organization_job uuid;
  contact_owner uuid;
begin
  if tg_table_name = 'job_contact_organizations' then
    select owner_id into job_owner from public.job_opportunities where id = new.job_opportunity_id;
    if job_owner is null or job_owner <> new.owner_id then raise exception 'Contact organization job must belong to owner'; end if;
  elsif tg_table_name = 'job_contact_searches' or tg_table_name = 'job_contacts' then
    select owner_id into job_owner from public.job_opportunities where id = new.job_opportunity_id;
    select owner_id, job_opportunity_id into organization_owner, organization_job from public.job_contact_organizations where id = new.organization_id;
    if job_owner is null or job_owner <> new.owner_id or organization_owner <> new.owner_id or organization_job <> new.job_opportunity_id then
      raise exception 'Contact intelligence associations must belong to the same owner and job';
    end if;
  elsif tg_table_name = 'job_contact_sources' or tg_table_name = 'job_contact_emails' then
    select owner_id into contact_owner from public.job_contacts where id = new.contact_id;
    if contact_owner is null or contact_owner <> new.owner_id then raise exception 'Contact child record must belong to owner'; end if;
  end if;
  return new;
end;
$$;

create trigger job_contact_organizations_validate_owner before insert or update on public.job_contact_organizations
for each row execute function public.validate_contact_intelligence_owner();
create trigger job_contact_searches_validate_owner before insert or update on public.job_contact_searches
for each row execute function public.validate_contact_intelligence_owner();
create trigger job_contacts_validate_owner before insert or update on public.job_contacts
for each row execute function public.validate_contact_intelligence_owner();
create trigger job_contact_sources_validate_owner before insert or update on public.job_contact_sources
for each row execute function public.validate_contact_intelligence_owner();
create trigger job_contact_emails_validate_owner before insert or update on public.job_contact_emails
for each row execute function public.validate_contact_intelligence_owner();

create function public.mark_contact_intelligence_stale_from_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.company_name is distinct from new.company_name then
    update public.job_contact_organizations set stale_at = coalesce(stale_at, now()), updated_at = now() where job_opportunity_id = new.id;
    update public.job_contact_searches set status = 'STALE', refresh_after = now(), updated_at = now() where job_opportunity_id = new.id;
    update public.job_contacts set status = 'STALE', stale_at = coalesce(stale_at, now()), updated_at = now() where job_opportunity_id = new.id and status = 'ACTIVE';
  end if;
  return new;
end;
$$;

create trigger job_opportunities_stale_contact_intelligence after update of company_name on public.job_opportunities
for each row execute function public.mark_contact_intelligence_stale_from_job();

create function public.set_preferred_job_contact(target_job uuid, target_contact uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare contact_owner uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select owner_id into contact_owner from public.job_contacts
  where id = target_contact and job_opportunity_id = target_job and status = 'ACTIVE';
  if contact_owner is null or contact_owner <> auth.uid() then raise exception 'Contact not found'; end if;
  update public.job_contacts set is_preferred = false where owner_id = auth.uid() and job_opportunity_id = target_job and is_preferred;
  update public.job_contacts set is_preferred = true where id = target_contact and owner_id = auth.uid();
end;
$$;

alter table public.job_contact_organizations enable row level security;
alter table public.job_contact_searches enable row level security;
alter table public.job_contacts enable row level security;
alter table public.job_contact_sources enable row level security;
alter table public.job_contact_emails enable row level security;

revoke all on table public.job_contact_organizations, public.job_contact_searches, public.job_contacts, public.job_contact_sources, public.job_contact_emails from anon, authenticated;
grant select, insert, update, delete on table public.job_contact_organizations, public.job_contact_searches, public.job_contacts, public.job_contact_sources, public.job_contact_emails to authenticated;

create policy "owners manage own contact organizations" on public.job_contact_organizations for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own contact searches" on public.job_contact_searches for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own job contacts" on public.job_contacts for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own contact sources" on public.job_contact_sources for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own contact emails" on public.job_contact_emails for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on function public.touch_contact_intelligence_updated_at() from public, anon, authenticated;
revoke all on function public.validate_contact_intelligence_owner() from public, anon, authenticated;
revoke all on function public.mark_contact_intelligence_stale_from_job() from public, anon, authenticated;
revoke all on function public.set_preferred_job_contact(uuid, uuid) from public, anon;
grant execute on function public.set_preferred_job_contact(uuid, uuid) to authenticated;
