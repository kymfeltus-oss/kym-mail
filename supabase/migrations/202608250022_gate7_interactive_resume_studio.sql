create type public.master_resume_version_status as enum ('DRAFT', 'REVIEW', 'APPROVED', 'STALE', 'ARCHIVED');
create type public.resume_share_status as enum ('ACTIVE', 'REVOKED');

create table public.master_resumes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.master_resume_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  master_resume_id uuid not null references public.master_resumes(id) on delete cascade,
  parent_version_id uuid references public.master_resume_versions(id) on delete set null,
  version_number integer not null check (version_number > 0),
  status public.master_resume_version_status not null default 'DRAFT',
  content jsonb not null check (jsonb_typeof(content) = 'object' and content <> '{}'::jsonb),
  validation_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_summary) = 'object'),
  career_fingerprint text not null check (career_fingerprint ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz,
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_resume_id, version_number),
  check ((status = 'APPROVED' and approved_at is not null) or status <> 'APPROVED'),
  check ((status = 'STALE' and stale_at is not null) or status <> 'STALE')
);

alter table public.master_resumes add constraint master_resumes_current_version_fkey
foreign key (current_version_id) references public.master_resume_versions(id) on delete set null;

create table public.master_resume_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  master_resume_version_id uuid not null references public.master_resume_versions(id) on delete cascade,
  content_key text not null check (content_key ~ '^[a-z0-9][a-z0-9._:-]{2,159}$'),
  evidence_type public.career_entity_type not null,
  evidence_id uuid not null,
  evidence_label text not null check (char_length(btrim(evidence_label)) between 2 and 300),
  created_at timestamptz not null default now(),
  unique (master_resume_version_id, content_key, evidence_type, evidence_id)
);

alter table public.tailored_resume_versions
  add column project_id uuid references public.projects(id) on delete set null,
  add column master_resume_version_id uuid references public.master_resume_versions(id) on delete restrict,
  add column strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy) = 'object'),
  add column resume_diff jsonb not null default '[]'::jsonb check (jsonb_typeof(resume_diff) = 'array'),
  add column review_decisions jsonb not null default '{}'::jsonb check (jsonb_typeof(review_decisions) = 'object'),
  add column request_fingerprint text check (request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$'),
  add column approved_at timestamptz,
  add column snapshot_locked_at timestamptz;

-- Pre-Gate-7 generated versions have no approved Master Resume baseline or
-- persisted material diff. Preserve them as history and require regeneration.
update public.tailored_resume_versions
set status = 'STALE', stale_at = coalesce(stale_at, now())
where status = 'READY';

alter table public.tailored_resume_versions
  add constraint tailored_resume_review_content_check check ((status in ('REVIEW', 'APPROVED') and generated_at is not null and content <> '{}'::jsonb and failure_code is null and failure_message is null) or status not in ('REVIEW', 'APPROVED')),
  add constraint tailored_resume_approved_check check ((status = 'APPROVED' and approved_at is not null and snapshot_locked_at is not null) or status <> 'APPROVED');

create unique index tailored_resume_versions_request_key on public.tailored_resume_versions (resume_id, request_fingerprint) where request_fingerprint is not null and status not in ('FAILED', 'ARCHIVED');
create index tailored_resume_versions_project_idx on public.tailored_resume_versions (owner_id, project_id, created_at desc);
create index master_resume_versions_owner_idx on public.master_resume_versions (owner_id, version_number desc);
create index master_resume_evidence_version_idx on public.master_resume_evidence (owner_id, master_resume_version_id, content_key);
create trigger master_resumes_touch_updated_at before update on public.master_resumes for each row execute function public.touch_tailored_resume_updated_at();
create trigger master_resume_versions_touch_updated_at before update on public.master_resume_versions for each row execute function public.touch_tailored_resume_updated_at();

create table public.resume_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  resume_version_id uuid not null references public.tailored_resume_versions(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  label text check (label is null or char_length(btrim(label)) between 2 and 120),
  status public.resume_share_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint not null default 0 check (access_count >= 0),
  check ((status = 'REVOKED' and revoked_at is not null) or status <> 'REVOKED')
);
create index resume_shares_owner_version_idx on public.resume_shares (owner_id, resume_version_id, created_at desc);

create or replace function public.validate_tailored_resume_version_owner()
returns trigger language plpgsql set search_path = '' as $$
declare resume_owner uuid; resume_job uuid; analysis_owner uuid; analysis_job uuid; parent_owner uuid; parent_resume uuid; master_owner uuid;
begin
  select owner_id, job_opportunity_id into resume_owner, resume_job from public.tailored_resumes where id = new.resume_id;
  select owner_id, job_opportunity_id into analysis_owner, analysis_job from public.job_analyses where id = new.job_analysis_id;
  if resume_owner is null or resume_owner <> new.owner_id or analysis_owner is null or analysis_owner <> new.owner_id or analysis_job <> resume_job then raise exception 'Resume version associations must belong to same owner and job'; end if;
  if new.parent_version_id is not null then
    select owner_id, resume_id into parent_owner, parent_resume from public.tailored_resume_versions where id = new.parent_version_id;
    if parent_owner is null or parent_owner <> new.owner_id or parent_resume <> new.resume_id then raise exception 'Parent resume version must belong to same resume'; end if;
  end if;
  if new.master_resume_version_id is not null then
    select owner_id into master_owner from public.master_resume_versions where id = new.master_resume_version_id;
    if master_owner is null or master_owner <> new.owner_id then raise exception 'Master Resume version must belong to same owner'; end if;
  end if;
  if new.project_id is not null and not exists (select 1 from public.job_opportunity_projects where owner_id = new.owner_id and project_id = new.project_id and job_opportunity_id = resume_job) then raise exception 'Resume Project must be associated with saved job'; end if;
  return new;
end; $$;

create or replace function public.validate_tailored_resume_export_owner()
returns trigger language plpgsql set search_path = '' as $$
declare version_owner uuid; version_status public.tailored_resume_version_status; version_approved_at timestamptz;
begin
  select owner_id, status, approved_at into version_owner, version_status, version_approved_at from public.tailored_resume_versions where id = new.resume_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_status not in ('APPROVED', 'STALE') or version_approved_at is null then raise exception 'Only an approved owner resume snapshot can be exported'; end if;
  return new;
end; $$;

drop trigger if exists tailored_resumes_validate_current_version on public.tailored_resumes;
create or replace function public.validate_tailored_resume_current_version()
returns trigger language plpgsql set search_path = '' as $$
declare version_owner uuid; version_resume uuid; version_status public.tailored_resume_version_status;
begin
  if new.current_version_id is null then return new; end if;
  select owner_id, resume_id, status into version_owner, version_resume, version_status from public.tailored_resume_versions where id = new.current_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_resume <> new.id or version_status not in ('REVIEW', 'APPROVED', 'STALE') then raise exception 'Current version must be reviewable or approved'; end if;
  return new;
end; $$;
create trigger tailored_resumes_validate_current_version before update of current_version_id on public.tailored_resumes for each row execute function public.validate_tailored_resume_current_version();

create function public.validate_master_resume_version_owner()
returns trigger language plpgsql set search_path = '' as $$
declare resume_owner uuid; parent_owner uuid; parent_resume uuid;
begin
  select owner_id into resume_owner from public.master_resumes where id = new.master_resume_id;
  if resume_owner is null or resume_owner <> new.owner_id then raise exception 'Master resume version must belong to owner'; end if;
  if new.parent_version_id is not null then
    select owner_id, master_resume_id into parent_owner, parent_resume from public.master_resume_versions where id = new.parent_version_id;
    if parent_owner is null or parent_owner <> new.owner_id or parent_resume <> new.master_resume_id then raise exception 'Master resume parent must belong to same resume'; end if;
  end if;
  return new;
end; $$;
create trigger master_resume_versions_validate_owner before insert or update on public.master_resume_versions for each row execute function public.validate_master_resume_version_owner();

create function public.validate_master_resume_current_version()
returns trigger language plpgsql set search_path = '' as $$
declare version_owner uuid; version_resume uuid; version_status public.master_resume_version_status;
begin
  if new.current_version_id is null then return new; end if;
  select owner_id, master_resume_id, status into version_owner, version_resume, version_status from public.master_resume_versions where id = new.current_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_resume <> new.id or version_status not in ('APPROVED', 'STALE') then raise exception 'Current Master Resume version must be approved'; end if;
  return new;
end; $$;
create trigger master_resumes_validate_current_version before update of current_version_id on public.master_resumes for each row execute function public.validate_master_resume_current_version();

create function public.validate_master_resume_evidence_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare version_owner uuid;
begin
  select owner_id into version_owner from public.master_resume_versions where id = new.master_resume_version_id;
  if version_owner is null or version_owner <> new.owner_id or not public.career_entity_belongs_to_owner(new.evidence_type, new.evidence_id, new.owner_id) then raise exception 'Master Resume evidence must belong to owner'; end if;
  return new;
end; $$;
create trigger master_resume_evidence_validate_owner before insert or update on public.master_resume_evidence for each row execute function public.validate_master_resume_evidence_owner();

create function public.lock_approved_resume_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.approved_at is not null and (
    new.owner_id is distinct from old.owner_id or new.resume_id is distinct from old.resume_id or
    new.job_analysis_id is distinct from old.job_analysis_id or new.parent_version_id is distinct from old.parent_version_id or
    new.project_id is distinct from old.project_id or new.master_resume_version_id is distinct from old.master_resume_version_id or
    new.version_number is distinct from old.version_number or new.generation_kind is distinct from old.generation_kind or
    new.provider_key is distinct from old.provider_key or new.provider_mode is distinct from old.provider_mode or
    new.plan is distinct from old.plan or new.content is distinct from old.content or new.strategy is distinct from old.strategy or
    new.resume_diff is distinct from old.resume_diff or new.review_decisions is distinct from old.review_decisions or
    new.validation_summary is distinct from old.validation_summary or new.analysis_version is distinct from old.analysis_version or
    new.description_fingerprint is distinct from old.description_fingerprint or new.career_fingerprint is distinct from old.career_fingerprint or
    new.request_fingerprint is distinct from old.request_fingerprint or new.failure_code is distinct from old.failure_code or
    new.failure_message is distinct from old.failure_message or new.generated_at is distinct from old.generated_at or
    new.approved_at is distinct from old.approved_at or new.snapshot_locked_at is distinct from old.snapshot_locked_at or
    new.created_at is distinct from old.created_at
  ) then raise exception 'Approved resume snapshots are immutable'; end if;
  return new;
end; $$;
create trigger tailored_resume_versions_lock_snapshot before update on public.tailored_resume_versions for each row execute function public.lock_approved_resume_snapshot();

create function public.lock_approved_master_resume_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.approved_at is not null and (
    new.owner_id is distinct from old.owner_id or new.master_resume_id is distinct from old.master_resume_id or
    new.parent_version_id is distinct from old.parent_version_id or new.version_number is distinct from old.version_number or
    new.content is distinct from old.content or new.validation_summary is distinct from old.validation_summary or
    new.career_fingerprint is distinct from old.career_fingerprint or new.approved_at is distinct from old.approved_at or
    new.created_at is distinct from old.created_at
  ) then raise exception 'Approved Master Resume snapshots are immutable'; end if;
  return new;
end; $$;
create trigger master_resume_versions_lock_snapshot before update on public.master_resume_versions for each row execute function public.lock_approved_master_resume_snapshot();

create function public.validate_resume_share_owner()
returns trigger language plpgsql set search_path = '' as $$
declare version_owner uuid; version_status public.tailored_resume_version_status; version_approved_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id or new.resume_version_id is distinct from old.resume_version_id or
       new.token_hash is distinct from old.token_hash or new.created_at is distinct from old.created_at then
      raise exception 'Resume share identity is immutable';
    end if;
    if old.status = 'REVOKED' and new.status <> 'REVOKED' then raise exception 'Revoked resume shares cannot be reactivated'; end if;
    return new;
  end if;
  select owner_id, status, approved_at into version_owner, version_status, version_approved_at from public.tailored_resume_versions where id = new.resume_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_status <> 'APPROVED' or version_approved_at is null then raise exception 'Only an approved owner resume version can be shared'; end if;
  return new;
end; $$;
create trigger resume_shares_validate_owner before insert or update on public.resume_shares for each row execute function public.validate_resume_share_owner();

create or replace function public.mark_resume_versions_stale_from_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.description_text is distinct from new.description_text then
    update public.tailored_resume_versions v set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now() from public.tailored_resumes r where r.id = v.resume_id and r.job_opportunity_id = new.id and v.status in ('REVIEW', 'APPROVED');
  end if;
  return new;
end; $$;

create or replace function public.mark_resume_versions_stale_from_analysis()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    update public.tailored_resume_versions v set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now() from public.tailored_resumes r where r.id = v.resume_id and r.job_opportunity_id = new.job_opportunity_id and v.job_analysis_id <> new.id and v.status in ('REVIEW', 'APPROVED');
  end if;
  return new;
end; $$;

create or replace function public.mark_gate7_resumes_stale_from_career()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_owner uuid := coalesce(new.owner_id, old.owner_id); target_id uuid; target_type public.career_entity_type; broad_change boolean := false;
begin
  case tg_table_name
    when 'career_profiles' then target_type := 'PROFILE'; target_id := target_owner;
    when 'career_organizations' then target_type := 'ORGANIZATION'; target_id := coalesce(new.id, old.id);
    when 'career_titles' then target_type := 'TITLE'; target_id := coalesce(new.id, old.id);
    when 'career_experiences' then target_type := 'EXPERIENCE'; target_id := coalesce(new.id, old.id);
    when 'career_education' then target_type := 'EDUCATION'; target_id := coalesce(new.id, old.id);
    when 'career_credentials' then target_type := 'CREDENTIAL'; target_id := coalesce(new.id, old.id);
    when 'career_skills' then target_type := 'SKILL'; target_id := coalesce(new.id, old.id);
    when 'career_projects' then target_type := 'PROJECT'; target_id := coalesce(new.id, old.id);
    when 'career_accomplishments' then target_type := 'ACCOMPLISHMENT'; target_id := coalesce(new.id, old.id);
    when 'career_metrics' then target_type := 'METRIC'; target_id := coalesce(new.id, old.id);
    else broad_change := true;
  end case;
  update public.tailored_resume_versions v set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now() where v.owner_id = target_owner and v.status in ('REVIEW', 'APPROVED') and (broad_change or exists (select 1 from public.tailored_resume_evidence e where e.resume_version_id = v.id and e.evidence_type = target_type and e.evidence_id = target_id));
  update public.master_resume_versions v set status = 'STALE', stale_at = coalesce(v.stale_at, now()), updated_at = now() where v.owner_id = target_owner and v.status in ('REVIEW', 'APPROVED') and (broad_change or exists (select 1 from public.master_resume_evidence e where e.master_resume_version_id = v.id and e.evidence_type = target_type and e.evidence_id = target_id));
  return coalesce(new, old);
end; $$;

do $$
declare career_table text;
begin
  foreach career_table in array array['career_profiles', 'career_organizations', 'career_titles', 'career_experiences', 'career_education', 'career_credentials', 'career_skills', 'career_projects', 'career_accomplishments', 'career_metrics', 'career_experience_skills', 'career_project_skills', 'career_aliases', 'career_provenance'] loop
    execute format('drop trigger if exists %I on public.%I', career_table || '_stale_tailored_resumes', career_table);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.mark_gate7_resumes_stale_from_career()', career_table || '_stale_gate7_resumes', career_table);
  end loop;
end; $$;

alter table public.master_resumes enable row level security;
alter table public.master_resume_versions enable row level security;
alter table public.master_resume_evidence enable row level security;
alter table public.resume_shares enable row level security;
revoke all on table public.master_resumes, public.master_resume_versions, public.master_resume_evidence, public.resume_shares from anon, authenticated;
grant select, insert, update on table public.master_resumes, public.master_resume_versions to authenticated;
grant select, insert on table public.master_resume_evidence, public.resume_shares to authenticated;
grant update (status, revoked_at) on table public.resume_shares to authenticated;
revoke delete on table public.tailored_resumes, public.tailored_resume_versions, public.tailored_resume_evidence from authenticated;
revoke update on table public.tailored_resume_evidence from authenticated;
create policy "owners manage own master resumes" on public.master_resumes for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own master resume versions" on public.master_resume_versions for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own master resume evidence" on public.master_resume_evidence for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners read own resume shares" on public.resume_shares for select using ((select auth.uid()) = owner_id);
create policy "owners create own resume shares" on public.resume_shares for insert with check ((select auth.uid()) = owner_id);
create policy "owners revoke own resume shares" on public.resume_shares for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on function public.validate_master_resume_version_owner() from public, anon, authenticated;
revoke all on function public.validate_master_resume_current_version() from public, anon, authenticated;
revoke all on function public.validate_master_resume_evidence_owner() from public, anon, authenticated;
revoke all on function public.lock_approved_resume_snapshot() from public, anon, authenticated;
revoke all on function public.lock_approved_master_resume_snapshot() from public, anon, authenticated;
revoke all on function public.validate_resume_share_owner() from public, anon, authenticated;
revoke all on function public.mark_gate7_resumes_stale_from_career() from public, anon, authenticated;
