create table public.career_fact_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entity_type public.career_entity_type not null,
  entity_id uuid not null,
  changed_fields text[] not null check (cardinality(changed_fields) > 0),
  old_record jsonb not null,
  new_record jsonb not null,
  change_source text not null check (change_source in ('OWNER_EDIT', 'CONTROLLED_IMPORT')),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index career_fact_history_owner_changed_idx
  on public.career_fact_history (owner_id, changed_at desc);
create index career_fact_history_entity_idx
  on public.career_fact_history (owner_id, entity_type, entity_id, changed_at desc);

alter table public.career_fact_history enable row level security;
revoke all on table public.career_fact_history from anon, authenticated;
grant select on table public.career_fact_history to authenticated;
create policy "owners read own career_fact_history"
  on public.career_fact_history for select
  using ((select auth.uid()) = owner_id);

create function public.capture_career_fact_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_value jsonb := to_jsonb(old);
  new_value jsonb := to_jsonb(new);
  fields text[];
  actor uuid := auth.uid();
  target_type public.career_entity_type := tg_argv[0]::public.career_entity_type;
  target_id uuid;
begin
  select array_agg(key order by key)
  into fields
  from jsonb_object_keys(new_value) as key
  where key not in ('created_at', 'updated_at')
    and old_value -> key is distinct from new_value -> key;

  if coalesce(cardinality(fields), 0) = 0 then
    return new;
  end if;

  if actor is not null and actor <> new.owner_id then
    raise exception 'Career fact history actor must be the record owner';
  end if;

  target_id := case when target_type = 'PROFILE' then new.owner_id else new.id end;
  insert into public.career_fact_history (
    owner_id, entity_type, entity_id, changed_fields, old_record, new_record,
    change_source, changed_by
  ) values (
    new.owner_id, target_type, target_id, fields, old_value, new_value,
    case when actor = new.owner_id then 'OWNER_EDIT' else 'CONTROLLED_IMPORT' end,
    actor
  );
  return new;
end;
$$;

revoke all on function public.capture_career_fact_history() from public, anon, authenticated;

create trigger career_profiles_capture_history after update on public.career_profiles
  for each row execute function public.capture_career_fact_history('PROFILE');
create trigger career_organizations_capture_history after update on public.career_organizations
  for each row execute function public.capture_career_fact_history('ORGANIZATION');
create trigger career_titles_capture_history after update on public.career_titles
  for each row execute function public.capture_career_fact_history('TITLE');
create trigger career_experiences_capture_history after update on public.career_experiences
  for each row execute function public.capture_career_fact_history('EXPERIENCE');
create trigger career_education_capture_history after update on public.career_education
  for each row execute function public.capture_career_fact_history('EDUCATION');
create trigger career_credentials_capture_history after update on public.career_credentials
  for each row execute function public.capture_career_fact_history('CREDENTIAL');
create trigger career_skills_capture_history after update on public.career_skills
  for each row execute function public.capture_career_fact_history('SKILL');
create trigger career_projects_capture_history after update on public.career_projects
  for each row execute function public.capture_career_fact_history('PROJECT');
create trigger career_accomplishments_capture_history after update on public.career_accomplishments
  for each row execute function public.capture_career_fact_history('ACCOMPLISHMENT');
create trigger career_metrics_capture_history after update on public.career_metrics
  for each row execute function public.capture_career_fact_history('METRIC');

grant update (full_name, professional_headline, location_text, professional_summary, years_experience_claim, authority_status)
  on public.career_profiles to authenticated;
grant update (canonical_name, organization_kind, authority_status)
  on public.career_organizations to authenticated;
grant update (canonical_name, authority_status)
  on public.career_titles to authenticated;
grant update (organization_id, client_organization_id, title_id, start_date, start_precision, end_date, end_precision, is_current, location_text, summary, completeness, authority_status)
  on public.career_experiences to authenticated;
grant update (degree_name, field_of_study, institution_name, completed_on, authority_status)
  on public.career_education to authenticated;
grant update (credential_name, credential_status, issuing_organization, authority_status)
  on public.career_credentials to authenticated;
grant update (canonical_name, category, authority_status)
  on public.career_skills to authenticated;
grant update (canonical_name, experience_id, client_organization_id, summary, business_challenge, architecture, impact, authority_status)
  on public.career_projects to authenticated;
grant update (experience_id, project_id, category, statement, authority_status)
  on public.career_accomplishments to authenticated;
grant update (accomplishment_id, metric_type, value_numeric, value_text, before_numeric, before_text, after_numeric, after_text, unit, currency, qualifier, scope_text, authority_status)
  on public.career_metrics to authenticated;

do $$
declare
  career_table text;
begin
  foreach career_table in array array[
    'career_profiles', 'career_organizations', 'career_titles', 'career_experiences',
    'career_education', 'career_credentials', 'career_skills', 'career_projects',
    'career_accomplishments', 'career_metrics'
  ] loop
    execute format(
      'create policy %I on public.%I for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id and authority_status = ''RESOLVED'')',
      'owners update own ' || career_table,
      career_table
    );
  end loop;
end;
$$;
