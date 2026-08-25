create type public.job_opportunity_status as enum ('SAVED', 'ARCHIVED');
create type public.job_work_arrangement as enum ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');
create type public.job_project_activity_type as enum ('JOB_SAVED', 'JOB_REMOVED');

create table public.job_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  provider_job_id text not null check (char_length(btrim(provider_job_id)) between 1 and 300),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  company_name text not null check (char_length(btrim(company_name)) between 1 and 200),
  company_identifier text check (company_identifier is null or char_length(company_identifier) <= 300),
  location_text text check (location_text is null or char_length(location_text) <= 300),
  work_arrangement public.job_work_arrangement not null default 'UNKNOWN',
  employment_types text[] not null default '{}'::text[] check (employment_types <@ array['FULL_TIME', 'PART_TIME', 'CONTRACT', 'PERMANENT']::text[]),
  salary_minimum integer check (salary_minimum is null or salary_minimum >= 0),
  salary_maximum integer check (salary_maximum is null or salary_maximum >= 0),
  salary_currency text check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$'),
  salary_period text check (salary_period is null or salary_period in ('YEAR')),
  description_text text not null default '' check (char_length(description_text) <= 30000),
  posted_at timestamptz,
  source_name text not null check (char_length(btrim(source_name)) between 1 and 100),
  source_url text not null check (source_url ~ '^https://'),
  application_url text not null check (application_url ~ '^https://'),
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  discovered_at timestamptz not null,
  saved_at timestamptz not null default now(),
  status public.job_opportunity_status not null default 'SAVED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_minimum is null or salary_maximum is null or salary_maximum >= salary_minimum),
  unique (owner_id, provider, provider_job_id)
);

create index job_opportunities_owner_status_saved_idx
  on public.job_opportunities (owner_id, status, saved_at desc);
create index job_opportunities_owner_company_idx
  on public.job_opportunities (owner_id, company_name);
create unique index job_opportunities_owner_source_url_key
  on public.job_opportunities (owner_id, source_url);

create table public.job_opportunity_projects (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  associated_at timestamptz not null default now(),
  primary key (job_opportunity_id, project_id)
);

create index job_opportunity_projects_owner_idx on public.job_opportunity_projects (owner_id);
create index job_opportunity_projects_project_idx on public.job_opportunity_projects (project_id, associated_at desc);

create table public.job_project_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  job_opportunity_id uuid references public.job_opportunities(id) on delete set null,
  activity_type public.job_project_activity_type not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index job_project_activity_project_occurred_idx on public.job_project_activity (project_id, occurred_at desc);
create index job_project_activity_owner_occurred_idx on public.job_project_activity (owner_id, occurred_at desc);

create function public.touch_job_opportunity_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger job_opportunities_touch_updated_at
before update on public.job_opportunities
for each row execute function public.touch_job_opportunity_updated_at();

create function public.validate_job_project_association()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.job_opportunities job
    where job.id = new.job_opportunity_id and job.owner_id = new.owner_id
  ) then
    raise exception 'Job opportunity must belong to the association owner';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = new.project_id
      and project.owner_id = new.owner_id
      and project.type = 'JOB_SEARCH'
      and project.status <> 'ARCHIVED'
  ) then
    raise exception 'Job opportunity may only be associated with an available Job Search Project';
  end if;
  return new;
end;
$$;

create trigger job_opportunity_projects_validate
before insert or update on public.job_opportunity_projects
for each row execute function public.validate_job_project_association();

create function public.record_job_project_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_title text;
begin
  select title into job_title
  from public.job_opportunities
  where id = coalesce(new.job_opportunity_id, old.job_opportunity_id);

  if tg_op = 'INSERT' then
    insert into public.job_project_activity (owner_id, project_id, job_opportunity_id, activity_type, details)
    values (new.owner_id, new.project_id, new.job_opportunity_id, 'JOB_SAVED', jsonb_build_object('title', job_title));
    return new;
  end if;

  insert into public.job_project_activity (owner_id, project_id, job_opportunity_id, activity_type, details)
  values (old.owner_id, old.project_id, old.job_opportunity_id, 'JOB_REMOVED', jsonb_build_object('title', job_title));
  return old;
end;
$$;

create trigger job_opportunity_projects_record_activity
after insert or delete on public.job_opportunity_projects
for each row execute function public.record_job_project_activity();

alter table public.job_opportunities enable row level security;
alter table public.job_opportunity_projects enable row level security;
alter table public.job_project_activity enable row level security;

create policy "owners read own job opportunities"
  on public.job_opportunities for select
  using ((select auth.uid()) = owner_id);
create policy "owners insert own job opportunities"
  on public.job_opportunities for insert
  with check ((select auth.uid()) = owner_id);
create policy "owners update own job opportunities"
  on public.job_opportunities for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete own job opportunities"
  on public.job_opportunities for delete
  using ((select auth.uid()) = owner_id);

create policy "owners read own job project associations"
  on public.job_opportunity_projects for select
  using ((select auth.uid()) = owner_id);
create policy "owners insert own job project associations"
  on public.job_opportunity_projects for insert
  with check ((select auth.uid()) = owner_id);
create policy "owners update own job project associations"
  on public.job_opportunity_projects for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete own job project associations"
  on public.job_opportunity_projects for delete
  using ((select auth.uid()) = owner_id);

create policy "owners read own job project activity"
  on public.job_project_activity for select
  using ((select auth.uid()) = owner_id);
