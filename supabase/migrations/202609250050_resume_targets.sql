create type public.resume_target_status as enum ('CONFIRMING', 'READY', 'FAILED');
create type public.resume_target_version_status as enum ('REVIEW');
create type public.resume_target_answer as enum ('YES', 'NO');

create table public.resume_targets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 300),
  employer text not null check (char_length(btrim(employer)) between 2 and 200),
  job_description text not null check (char_length(btrim(job_description)) between 120 and 30000),
  description_fingerprint text not null check (description_fingerprint ~ '^[a-f0-9]{64}$'),
  status public.resume_target_status not null default 'CONFIRMING',
  current_version_id uuid,
  failure_message text check (failure_message is null or char_length(btrim(failure_message)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resume_target_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.resume_targets(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  original_text text not null check (char_length(btrim(original_text)) between 3 and 2000),
  category text not null check (category in ('RESPONSIBILITY', 'SKILL', 'TECHNOLOGY', 'SYSTEM', 'ACCOUNTING', 'FINANCE', 'DATA', 'EDUCATION', 'CERTIFICATION', 'EXPERIENCE', 'LEADERSHIP', 'INDUSTRY', 'OTHER')),
  importance text not null check (importance in ('REQUIRED', 'PREFERRED', 'RESPONSIBILITY', 'CONTEXT')),
  match_state text not null check (match_state in ('STRONG_MATCH', 'MATCH', 'PARTIAL_MATCH', 'NO_MATCH', 'UNVERIFIED', 'NOT_APPLICABLE')),
  explanation text not null check (char_length(btrim(explanation)) between 3 and 2000),
  matched_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(matched_evidence) = 'array'),
  needs_confirmation boolean not null,
  created_at timestamptz not null default now(),
  unique (target_id, sequence_number)
);

create table public.resume_target_confirmations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.resume_targets(id) on delete cascade,
  requirement_id uuid not null references public.resume_target_requirements(id) on delete cascade,
  answer public.resume_target_answer not null,
  prompt_text text not null default '' check (char_length(prompt_text) <= 2000),
  decided_at timestamptz not null default now(),
  unique (target_id, requirement_id),
  check ((answer = 'YES' and char_length(btrim(prompt_text)) between 20 and 2000) or (answer = 'NO' and char_length(btrim(prompt_text)) = 0))
);

create table public.resume_target_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.resume_targets(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.resume_target_version_status not null default 'REVIEW',
  content jsonb not null check (jsonb_typeof(content) = 'object' and content <> '{}'::jsonb),
  created_at timestamptz not null default now(),
  unique (target_id, version_number)
);

alter table public.resume_targets
  add constraint resume_targets_current_version_fkey
  foreign key (current_version_id) references public.resume_target_versions(id) on delete set null;

create index resume_targets_owner_created_idx on public.resume_targets (owner_id, created_at desc);
create index resume_target_requirements_target_idx on public.resume_target_requirements (owner_id, target_id, sequence_number);
create index resume_target_confirmations_target_idx on public.resume_target_confirmations (owner_id, target_id);
create index resume_target_versions_target_idx on public.resume_target_versions (owner_id, target_id, version_number desc);

create trigger resume_targets_touch_updated_at before update on public.resume_targets
for each row execute function public.touch_tailored_resume_updated_at();

create function public.validate_resume_target_child_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_owner uuid;
begin
  select owner_id into target_owner from public.resume_targets where id = new.target_id;
  if target_owner is null or target_owner <> new.owner_id then
    raise exception 'Resume target child must belong to the same owner';
  end if;
  return new;
end;
$$;

create trigger resume_target_requirements_validate_owner before insert or update on public.resume_target_requirements
for each row execute function public.validate_resume_target_child_owner();
create trigger resume_target_confirmations_validate_owner before insert or update on public.resume_target_confirmations
for each row execute function public.validate_resume_target_child_owner();
create trigger resume_target_versions_validate_owner before insert or update on public.resume_target_versions
for each row execute function public.validate_resume_target_child_owner();

create function public.validate_resume_target_confirmation_requirement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  requirement_target uuid;
  requirement_needs boolean;
begin
  select target_id, needs_confirmation into requirement_target, requirement_needs
  from public.resume_target_requirements
  where id = new.requirement_id and owner_id = new.owner_id;
  if requirement_target is null or requirement_target <> new.target_id or requirement_needs is not true then
    raise exception 'Confirmation must belong to a pending requirement on this resume target';
  end if;
  return new;
end;
$$;

create trigger resume_target_confirmations_validate_requirement before insert or update on public.resume_target_confirmations
for each row execute function public.validate_resume_target_confirmation_requirement();

create function public.validate_resume_target_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_owner uuid;
  version_target uuid;
begin
  if new.current_version_id is null then return new; end if;
  select owner_id, target_id into version_owner, version_target
  from public.resume_target_versions
  where id = new.current_version_id;
  if version_owner is null or version_owner <> new.owner_id or version_target <> new.id then
    raise exception 'Current targeted resume version must belong to this resume target';
  end if;
  return new;
end;
$$;

create trigger resume_targets_validate_current_version before update of current_version_id on public.resume_targets
for each row execute function public.validate_resume_target_current_version();

alter table public.resume_targets enable row level security;
alter table public.resume_target_requirements enable row level security;
alter table public.resume_target_confirmations enable row level security;
alter table public.resume_target_versions enable row level security;

revoke all on table public.resume_targets, public.resume_target_requirements, public.resume_target_confirmations, public.resume_target_versions from anon, authenticated;
grant select, insert, update on table public.resume_targets, public.resume_target_requirements, public.resume_target_confirmations, public.resume_target_versions to authenticated;
grant delete on table public.resume_target_confirmations to authenticated;

create policy "owners manage own resume targets" on public.resume_targets
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own resume target requirements" on public.resume_target_requirements
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own resume target confirmations" on public.resume_target_confirmations
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own resume target versions" on public.resume_target_versions
  for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on function public.validate_resume_target_child_owner() from public, anon, authenticated;
revoke all on function public.validate_resume_target_confirmation_requirement() from public, anon, authenticated;
revoke all on function public.validate_resume_target_current_version() from public, anon, authenticated;
