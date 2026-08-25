-- Gate 7 job intelligence: structured JD requirements, evidence-linked matches, and owner-only analysis state.
--
-- Match states (application logic is authoritative; AI cannot store a different state):
--   STRONG_MATCH   deterministic relevance >= 82, or a direct canonical-concept match with supporting records
--   MATCH          deterministic relevance 62–81
--   PARTIAL_MATCH  deterministic relevance 30–61, including related-but-not-identical concepts
--   NO_MATCH       closed-world requirement evaluated against the profile and unsupported
--   UNVERIFIED     profile does not contain enough information to decide; excluded from the percentage
--   NOT_APPLICABLE legal/benefits/authorization language; excluded from the percentage
--
-- Scoring model weighted-requirement-v1:
--   scored = requirements whose state is not NOT_APPLICABLE or UNVERIFIED
--   overall = round(100 * sum(importance_weight * match_value) / sum(importance_weight))
--   weights: REQUIRED=5, CONTEXT=3, PREFERRED=2
--   values:  STRONG_MATCH=1.0, MATCH=0.8, PARTIAL_MATCH=0.45, NO_MATCH=0
--   UNVERIFIED and NOT_APPLICABLE are omitted from both earned and possible points.

create type public.job_analysis_status as enum ('NOT_ANALYZED', 'ANALYZING', 'COMPLETE', 'FAILED', 'STALE');
create type public.job_requirement_importance as enum ('REQUIRED', 'PREFERRED', 'CONTEXT');
create type public.job_requirement_category as enum (
  'RESPONSIBILITY', 'SKILL', 'TECHNOLOGY', 'SYSTEM', 'ACCOUNTING', 'FINANCE', 'DATA',
  'EDUCATION', 'CERTIFICATION', 'EXPERIENCE', 'LEADERSHIP', 'INDUSTRY', 'OTHER'
);
create type public.job_requirement_match_state as enum (
  'STRONG_MATCH', 'MATCH', 'PARTIAL_MATCH', 'NO_MATCH', 'UNVERIFIED', 'NOT_APPLICABLE'
);
create type public.job_requirement_gap_reason as enum (
  'CERTIFICATION_NOT_HELD', 'TECHNOLOGY_ABSENT', 'INDUSTRY_EXPERIENCE_ABSENT',
  'EDUCATION_MISMATCH', 'INSUFFICIENT_EVIDENCE', 'UNVERIFIABLE', 'YEARS_INSUFFICIENT'
);

create table public.job_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_opportunity_id uuid not null references public.job_opportunities(id) on delete cascade,
  analysis_version integer not null check (analysis_version > 0),
  analyzer_version text not null check (analyzer_version ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  status public.job_analysis_status not null default 'NOT_ANALYZED',
  description_fingerprint text not null check (description_fingerprint ~ '^[a-f0-9]{64}$'),
  career_fingerprint text not null check (career_fingerprint ~ '^[a-f0-9]{64}$'),
  job_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(job_snapshot) = 'object'),
  result_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(result_summary) = 'object'),
  overall_score integer check (overall_score is null or overall_score between 0 and 100),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  failure_message text check (failure_message is null or char_length(btrim(failure_message)) between 3 and 500),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_opportunity_id, analysis_version),
  check ((status = 'COMPLETE' and overall_score is not null and completed_at is not null and failure_code is null and failure_message is null)
    or status <> 'COMPLETE'),
  check ((status = 'FAILED' and failure_code is not null and failure_message is not null)
    or status <> 'FAILED'),
  check ((status = 'STALE' and stale_at is not null) or status <> 'STALE')
);

create index job_analyses_owner_job_version_idx
  on public.job_analyses (owner_id, job_opportunity_id, analysis_version desc);
create unique index job_analyses_one_analyzing_per_job_idx
  on public.job_analyses (job_opportunity_id) where status = 'ANALYZING';
create unique index job_analyses_one_complete_per_job_idx
  on public.job_analyses (job_opportunity_id) where status = 'COMPLETE';

create table public.job_analysis_requirements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null references public.job_analyses(id) on delete cascade,
  sequence_number integer not null check (sequence_number between 1 and 200),
  importance public.job_requirement_importance not null,
  category public.job_requirement_category not null,
  original_text text not null check (char_length(btrim(original_text)) between 3 and 2000),
  normalized_text text not null check (char_length(btrim(normalized_text)) between 3 and 2000),
  normalized_concept text check (normalized_concept is null or char_length(btrim(normalized_concept)) between 2 and 80),
  match_state public.job_requirement_match_state not null,
  match_confidence integer not null check (match_confidence between 0 and 100),
  scoring_weight integer not null check (scoring_weight between 1 and 10),
  score_contribution numeric(8,4) not null check (score_contribution >= 0),
  explanation text not null check (char_length(btrim(explanation)) between 3 and 1000),
  gap_reason public.job_requirement_gap_reason,
  is_material boolean not null default false,
  created_at timestamptz not null default now(),
  unique (analysis_id, sequence_number),
  check (
    (match_state in ('NO_MATCH', 'UNVERIFIED') and gap_reason is not null)
    or (match_state not in ('NO_MATCH', 'UNVERIFIED') and gap_reason is null)
  )
);

create index job_analysis_requirements_owner_analysis_idx
  on public.job_analysis_requirements (owner_id, analysis_id, sequence_number);
create index job_analysis_requirements_state_idx
  on public.job_analysis_requirements (analysis_id, match_state, importance);

create table public.job_analysis_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id uuid not null references public.job_analysis_requirements(id) on delete cascade,
  evidence_type public.career_entity_type not null,
  evidence_id uuid not null,
  relevance_score integer not null check (relevance_score between 1 and 100),
  evidence_label text not null check (char_length(btrim(evidence_label)) between 2 and 300),
  evidence_excerpt text not null check (char_length(btrim(evidence_excerpt)) between 3 and 2000),
  match_explanation text not null check (char_length(btrim(match_explanation)) between 3 and 1000),
  created_at timestamptz not null default now(),
  unique (requirement_id, evidence_type, evidence_id)
);

create index job_analysis_evidence_owner_requirement_idx
  on public.job_analysis_evidence (owner_id, requirement_id, relevance_score desc);
create index job_analysis_evidence_career_record_idx
  on public.job_analysis_evidence (owner_id, evidence_type, evidence_id);

create function public.touch_job_analysis_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger job_analyses_touch_updated_at
before update on public.job_analyses
for each row execute function public.touch_job_analysis_updated_at();

create function public.validate_job_analysis_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.job_opportunities
    where id = new.job_opportunity_id and owner_id = new.owner_id and status = 'SAVED'
  ) then
    raise exception 'Job analysis must reference an owner saved job';
  end if;
  return new;
end;
$$;

create trigger job_analyses_validate_owner
before insert or update of owner_id, job_opportunity_id on public.job_analyses
for each row execute function public.validate_job_analysis_owner();

create function public.validate_job_requirement_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.job_analyses
    where id = new.analysis_id and owner_id = new.owner_id
  ) then
    raise exception 'Job requirement must reference an owner analysis';
  end if;
  return new;
end;
$$;

create trigger job_analysis_requirements_validate_owner
before insert or update of owner_id, analysis_id on public.job_analysis_requirements
for each row execute function public.validate_job_requirement_owner();

create function public.validate_job_analysis_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requirement_state public.job_requirement_match_state;
begin
  select match_state into requirement_state
  from public.job_analysis_requirements
  where id = new.requirement_id and owner_id = new.owner_id;

  if requirement_state is null then
    raise exception 'Job evidence must reference an owner requirement';
  end if;
  if requirement_state not in ('STRONG_MATCH', 'MATCH', 'PARTIAL_MATCH') then
    raise exception 'Only a positive or partial match may have supporting evidence';
  end if;
  if not public.career_entity_belongs_to_owner(new.evidence_type, new.evidence_id, new.owner_id) then
    raise exception 'Job evidence must reference authoritative career data owned by the analysis owner';
  end if;
  return new;
end;
$$;

create trigger job_analysis_evidence_validate
before insert or update on public.job_analysis_evidence
for each row execute function public.validate_job_analysis_evidence();

revoke all on function public.validate_job_analysis_evidence() from public, anon, authenticated;

create function public.validate_completed_job_analysis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'COMPLETE' then
    if not exists (select 1 from public.job_analysis_requirements where analysis_id = new.id and owner_id = new.owner_id) then
      raise exception 'A completed job analysis requires structured requirements';
    end if;
    if exists (
      select 1
      from public.job_analysis_requirements requirement
      where requirement.analysis_id = new.id
        and requirement.owner_id = new.owner_id
        and requirement.match_state in ('STRONG_MATCH', 'MATCH', 'PARTIAL_MATCH')
        and not exists (
          select 1 from public.job_analysis_evidence evidence
          where evidence.requirement_id = requirement.id and evidence.owner_id = new.owner_id
        )
    ) then
      raise exception 'Every positive job match requires persisted career evidence';
    end if;
  end if;
  return new;
end;
$$;

create constraint trigger job_analyses_validate_completion
after insert or update of status on public.job_analyses
deferrable initially deferred
for each row execute function public.validate_completed_job_analysis();

revoke all on function public.validate_completed_job_analysis() from public, anon, authenticated;

create function public.mark_job_analysis_stale_on_description_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if md5(regexp_replace(lower(btrim(coalesce(old.description_text, ''))), '\s+', ' ', 'g'))
     is distinct from md5(regexp_replace(lower(btrim(coalesce(new.description_text, ''))), '\s+', ' ', 'g')) then
    update public.job_analyses
      set status = 'STALE', stale_at = now()
      where job_opportunity_id = new.id and owner_id = new.owner_id and status = 'COMPLETE';
  end if;
  return new;
end;
$$;

create trigger job_opportunities_stale_analysis_after_description_change
after update of description_text on public.job_opportunities
for each row execute function public.mark_job_analysis_stale_on_description_change();

revoke all on function public.mark_job_analysis_stale_on_description_change() from public, anon, authenticated;

create function public.mark_owner_job_analyses_stale_on_career_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_owner uuid;
begin
  affected_owner := coalesce(new.owner_id, old.owner_id);
  update public.job_analyses
    set status = 'STALE', stale_at = now()
    where owner_id = affected_owner and status = 'COMPLETE';
  return coalesce(new, old);
end;
$$;

create trigger career_profiles_stale_job_analyses after insert or update or delete on public.career_profiles for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_experiences_stale_job_analyses after insert or update or delete on public.career_experiences for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_education_stale_job_analyses after insert or update or delete on public.career_education for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_credentials_stale_job_analyses after insert or update or delete on public.career_credentials for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_skills_stale_job_analyses after insert or update or delete on public.career_skills for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_projects_stale_job_analyses after insert or update or delete on public.career_projects for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_accomplishments_stale_job_analyses after insert or update or delete on public.career_accomplishments for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_metrics_stale_job_analyses after insert or update or delete on public.career_metrics for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_experience_skills_stale_job_analyses after insert or update or delete on public.career_experience_skills for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_project_skills_stale_job_analyses after insert or update or delete on public.career_project_skills for each row execute function public.mark_owner_job_analyses_stale_on_career_change();
create trigger career_aliases_stale_job_analyses after insert or update or delete on public.career_aliases for each row execute function public.mark_owner_job_analyses_stale_on_career_change();

revoke all on function public.mark_owner_job_analyses_stale_on_career_change() from public, anon, authenticated;

alter table public.job_analyses enable row level security;
alter table public.job_analysis_requirements enable row level security;
alter table public.job_analysis_evidence enable row level security;

revoke all on table public.job_analyses, public.job_analysis_requirements, public.job_analysis_evidence from anon, authenticated;
grant select, insert, update, delete on table public.job_analyses, public.job_analysis_requirements, public.job_analysis_evidence to authenticated;

create policy "owners read own job analyses" on public.job_analyses for select using ((select auth.uid()) = owner_id);
create policy "owners insert own job analyses" on public.job_analyses for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own job analyses" on public.job_analyses for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own job analyses" on public.job_analyses for delete using ((select auth.uid()) = owner_id);

create policy "owners read own job requirements" on public.job_analysis_requirements for select using ((select auth.uid()) = owner_id);
create policy "owners insert own job requirements" on public.job_analysis_requirements for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own job requirements" on public.job_analysis_requirements for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own job requirements" on public.job_analysis_requirements for delete using ((select auth.uid()) = owner_id);

create policy "owners read own job evidence" on public.job_analysis_evidence for select using ((select auth.uid()) = owner_id);
create policy "owners insert own job evidence" on public.job_analysis_evidence for insert with check ((select auth.uid()) = owner_id);
create policy "owners update own job evidence" on public.job_analysis_evidence for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners delete own job evidence" on public.job_analysis_evidence for delete using ((select auth.uid()) = owner_id);
