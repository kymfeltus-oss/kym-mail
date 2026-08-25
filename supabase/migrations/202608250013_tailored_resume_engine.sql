create type public.tailored_resume_status as enum ('ACTIVE', 'ARCHIVED');
create type public.tailored_resume_version_status as enum ('DRAFT', 'GENERATING', 'READY', 'FAILED', 'STALE', 'ARCHIVED');
create type public.tailored_resume_generation_kind as enum ('INITIAL', 'USER_EDIT', 'REGENERATED', 'SUMMARY_REGENERATION', 'BULLET_REGENERATION');
create type public.tailored_resume_export_format as enum ('DOCX', 'PDF');

create table public.tailored_resumes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  status public.tailored_resume_status not null default 'ACTIVE',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, job_opportunity_id)
);

create table public.tailored_resume_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
  job_analysis_id uuid not null references public.job_analyses(id) on delete restrict,
  parent_version_id uuid references public.tailored_resume_versions(id) on delete set null,
  version_number integer not null check (version_number > 0),
  generation_kind public.tailored_resume_generation_kind not null,
  status public.tailored_resume_version_status not null default 'GENERATING',
  provider_key text not null check (provider_key ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  provider_mode text not null check (provider_mode in ('DETERMINISTIC', 'AI')),
  plan jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  validation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_summary) = 'object'),
  analysis_version integer not null check (analysis_version > 0),
  description_fingerprint text not null check (description_fingerprint ~ '^[a-f0-9]{64}$'),
  career_fingerprint text not null check (career_fingerprint ~ '^[a-f0-9]{64}$'),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  failure_message text check (failure_message is null or char_length(btrim(failure_message)) between 3 and 500),
  generated_at timestamptz,
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resume_id, version_number),
  check ((status = 'READY' and generated_at is not null and content <> '{}'::jsonb and failure_code is null and failure_message is null) or status <> 'READY'),
  check ((status = 'FAILED' and failure_code is not null and failure_message is not null) or status <> 'FAILED'),
  check ((status = 'STALE' and stale_at is not null) or status <> 'STALE')
);

alter table public.tailored_resumes
  add constraint tailored_resumes_current_version_fkey
  foreign key (current_version_id) references public.tailored_resume_versions(id) on delete set null;

create table public.tailored_resume_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  resume_version_id uuid not null references public.tailored_resume_versions(id) on delete cascade,
  content_key text not null check (content_key ~ '^[a-z0-9][a-z0-9._:-]{2,159}$'),
  evidence_type public.career_entity_type not null,
  evidence_id uuid not null,
  evidence_label text not null check (char_length(btrim(evidence_label)) between 2 and 300),
  created_at timestamptz not null default now(),
  unique (resume_version_id, content_key, evidence_type, evidence_id)
);

create table public.tailored_resume_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  resume_version_id uuid not null references public.tailored_resume_versions(id) on delete cascade,
  export_format public.tailored_resume_export_format not null,
  filename text not null check (filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,179}\.(docx|pdf)$'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  exported_at timestamptz not null default now()
);

create index tailored_resumes_owner_job_idx on public.tailored_resumes (owner_id, job_opportunity_id);
create index tailored_resume_versions_resume_version_idx on public.tailored_resume_versions (owner_id, resume_id, version_number desc);
create index tailored_resume_versions_analysis_idx on public.tailored_resume_versions (owner_id, job_analysis_id);
create index tailored_resume_evidence_version_idx on public.tailored_resume_evidence (owner_id, resume_version_id, content_key);
create index tailored_resume_exports_version_idx on public.tailored_resume_exports (owner_id, resume_version_id, exported_at desc);

create function public.touch_tailored_resume_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tailored_resumes_touch_updated_at before update on public.tailored_resumes
for each row execute function public.touch_tailored_resume_updated_at();
create trigger tailored_resume_versions_touch_updated_at before update on public.tailored_resume_versions
for each row execute function public.touch_tailored_resume_updated_at();

create function public.validate_tailored_resume_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_owner uuid;
begin
  select owner_id into target_owner from public.job_opportunities where id = new.job_opportunity_id;
  if target_owner is null or target_owner <> new.owner_id then
    raise exception 'Tailored resume job must belong to owner';
  end if;
  return new;
end;
$$;

create trigger tailored_resumes_validate_owner before insert or update on public.tailored_resumes
for each row execute function public.validate_tailored_resume_owner();

create function public.validate_tailored_resume_version_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resume_owner uuid;
  resume_job uuid;
  analysis_owner uuid;
  analysis_job uuid;
  parent_owner uuid;
  parent_resume uuid;
begin
  select owner_id, job_opportunity_id into resume_owner, resume_job from public.tailored_resumes where id = new.resume_id;
  select owner_id, job_opportunity_id into analysis_owner, analysis_job from public.job_analyses where id = new.job_analysis_id;
  if resume_owner is null or resume_owner <> new.owner_id or analysis_owner is null or analysis_owner <> new.owner_id or analysis_job <> resume_job then
    raise exception 'Resume version associations must belong to the same owner and job';
  end if;
  if new.parent_version_id is not null then
    select owner_id, resume_id into parent_owner, parent_resume from public.tailored_resume_versions where id = new.parent_version_id;
    if parent_owner is null or parent_owner <> new.owner_id or parent_resume <> new.resume_id then
      raise exception 'Parent resume version must belong to the same resume';
    end if;
  end if;
  return new;
end;
$$;

create trigger tailored_resume_versions_validate_owner before insert or update on public.tailored_resume_versions
for each row execute function public.validate_tailored_resume_version_owner();

create function public.validate_tailored_resume_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_owner uuid;
  version_resume uuid;
  version_status public.tailored_resume_version_status;
begin
  if new.current_version_id is null then return new; end if;
  select owner_id, resume_id, status into version_owner, version_resume, version_status
  from public.tailored_resume_versions where id = new.current_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_resume <> new.id or version_status not in ('READY', 'STALE') then
    raise exception 'Current version must be a successful version of this resume';
  end if;
  return new;
end;
$$;

create trigger tailored_resumes_validate_current_version before update of current_version_id on public.tailored_resumes
for each row execute function public.validate_tailored_resume_current_version();

create function public.validate_tailored_resume_evidence_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_owner uuid;
begin
  select owner_id into version_owner from public.tailored_resume_versions where id = new.resume_version_id;
  if version_owner is null or version_owner <> new.owner_id or not public.career_entity_belongs_to_owner(new.evidence_type, new.evidence_id, new.owner_id) then
    raise exception 'Resume evidence must belong to the same owner';
  end if;
  return new;
end;
$$;

create trigger tailored_resume_evidence_validate_owner before insert or update on public.tailored_resume_evidence
for each row execute function public.validate_tailored_resume_evidence_owner();

create function public.validate_tailored_resume_export_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_owner uuid;
  version_status public.tailored_resume_version_status;
begin
  select owner_id, status into version_owner, version_status from public.tailored_resume_versions where id = new.resume_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_status not in ('READY', 'STALE') then
    raise exception 'Only a successful owner resume version can be exported';
  end if;
  return new;
end;
$$;

create trigger tailored_resume_exports_validate_owner before insert or update on public.tailored_resume_exports
for each row execute function public.validate_tailored_resume_export_owner();

create function public.mark_owner_resume_versions_stale(target_owner uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tailored_resume_versions
  set status = 'STALE', stale_at = coalesce(stale_at, now()), updated_at = now()
  where owner_id = target_owner and status = 'READY';
$$;

create function public.mark_resume_versions_stale_from_career()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_owner_resume_versions_stale(coalesce(new.owner_id, old.owner_id));
  return coalesce(new, old);
end;
$$;

do $$
declare
  career_table text;
begin
  foreach career_table in array array[
    'career_profiles', 'career_organizations', 'career_titles', 'career_experiences',
    'career_education', 'career_credentials', 'career_skills', 'career_projects',
    'career_accomplishments', 'career_metrics', 'career_experience_skills',
    'career_project_skills', 'career_aliases', 'career_provenance'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.mark_resume_versions_stale_from_career()',
      career_table || '_stale_tailored_resumes', career_table
    );
  end loop;
end;
$$;

create function public.mark_resume_versions_stale_from_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.description_text is distinct from new.description_text then
    update public.tailored_resume_versions v
    set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now()
    from public.tailored_resumes r
    where r.id = v.resume_id and r.job_opportunity_id = new.id and v.status = 'READY';
  end if;
  return new;
end;
$$;

create trigger job_opportunities_stale_tailored_resumes after update of description_text on public.job_opportunities
for each row execute function public.mark_resume_versions_stale_from_job();

create function public.mark_resume_versions_stale_from_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    update public.tailored_resume_versions v
    set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now()
    from public.tailored_resumes r
    where r.id = v.resume_id
      and r.job_opportunity_id = new.job_opportunity_id
      and v.job_analysis_id <> new.id
      and v.status = 'READY';
  end if;
  return new;
end;
$$;

create trigger job_analyses_stale_tailored_resumes after insert or update of status on public.job_analyses
for each row execute function public.mark_resume_versions_stale_from_analysis();

alter table public.tailored_resumes enable row level security;
alter table public.tailored_resume_versions enable row level security;
alter table public.tailored_resume_evidence enable row level security;
alter table public.tailored_resume_exports enable row level security;

revoke all on table public.tailored_resumes, public.tailored_resume_versions, public.tailored_resume_evidence, public.tailored_resume_exports from anon, authenticated;
grant select, insert, update, delete on table public.tailored_resumes, public.tailored_resume_versions, public.tailored_resume_evidence to authenticated;
grant select, insert on table public.tailored_resume_exports to authenticated;

create policy "owners read own tailored resumes" on public.tailored_resumes for select using ((select auth.uid()) = owner_id);
create policy "owners insert own tailored resumes" on public.tailored_resumes for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own tailored resumes" on public.tailored_resumes for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own tailored resumes" on public.tailored_resumes for delete using ((select auth.uid()) = owner_id);

create policy "owners read own tailored resume versions" on public.tailored_resume_versions for select using ((select auth.uid()) = owner_id);
create policy "owners insert own tailored resume versions" on public.tailored_resume_versions for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own tailored resume versions" on public.tailored_resume_versions for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own tailored resume versions" on public.tailored_resume_versions for delete using ((select auth.uid()) = owner_id);

create policy "owners read own tailored resume evidence" on public.tailored_resume_evidence for select using ((select auth.uid()) = owner_id);
create policy "owners insert own tailored resume evidence" on public.tailored_resume_evidence for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own tailored resume evidence" on public.tailored_resume_evidence for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own tailored resume evidence" on public.tailored_resume_evidence for delete using ((select auth.uid()) = owner_id);

create policy "owners read own tailored resume exports" on public.tailored_resume_exports for select using ((select auth.uid()) = owner_id);
create policy "owners insert own tailored resume exports" on public.tailored_resume_exports for insert with check ((select auth.uid()) = owner_id);

revoke all on function public.validate_tailored_resume_owner() from public, anon, authenticated;
revoke all on function public.validate_tailored_resume_version_owner() from public, anon, authenticated;
revoke all on function public.validate_tailored_resume_current_version() from public, anon, authenticated;
revoke all on function public.validate_tailored_resume_evidence_owner() from public, anon, authenticated;
revoke all on function public.validate_tailored_resume_export_owner() from public, anon, authenticated;
revoke all on function public.mark_owner_resume_versions_stale(uuid) from public, anon, authenticated;
revoke all on function public.mark_resume_versions_stale_from_career() from public, anon, authenticated;
revoke all on function public.mark_resume_versions_stale_from_job() from public, anon, authenticated;
revoke all on function public.mark_resume_versions_stale_from_analysis() from public, anon, authenticated;
