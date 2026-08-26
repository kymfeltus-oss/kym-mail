-- Gate 6B Career Match contract correction.
-- Responsibilities are independent from both qualification importance and semantic category.
-- Positive analysis evidence must point to confirmed authoritative career data only.

alter type public.job_requirement_importance
  add value if not exists 'RESPONSIBILITY' after 'PREFERRED';

create or replace function public.career_entity_is_confirmed_for_owner(
  entity_kind public.career_entity_type,
  target_id uuid,
  target_owner uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  return case entity_kind
    when 'PROFILE' then exists (
      select 1 from public.career_profiles
      where owner_id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'EXPERIENCE' then exists (
      select 1 from public.career_experiences
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'EDUCATION' then exists (
      select 1 from public.career_education
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'CREDENTIAL' then exists (
      select 1 from public.career_credentials
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'SKILL' then exists (
      select 1 from public.career_skills
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'PROJECT' then exists (
      select 1 from public.career_projects
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'ACCOMPLISHMENT' then exists (
      select 1 from public.career_accomplishments
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    when 'METRIC' then exists (
      select 1 from public.career_metrics
      where id = target_id and owner_id = target_owner
        and authority_status in ('AUTHORITATIVE', 'RESOLVED')
    )
    else false
  end;
end;
$$;

revoke all on function public.career_entity_is_confirmed_for_owner(public.career_entity_type, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.validate_job_analysis_evidence()
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
  if not public.career_entity_is_confirmed_for_owner(new.evidence_type, new.evidence_id, new.owner_id) then
    raise exception 'Job evidence must reference confirmed authoritative career data owned by the analysis owner';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_job_analysis_evidence() from public, anon, authenticated;

-- Analyzer v2 changes the importance contract and evidence eligibility. Preserve prior
-- versions for history, but require an explicit owner-triggered re-analysis before reuse.
update public.job_analyses
set status = 'STALE', stale_at = now()
where status = 'COMPLETE'
  and analyzer_version <> 'deterministic-evidence-v2';

