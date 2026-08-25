create type public.career_authority_status as enum ('AUTHORITATIVE', 'SUPPLEMENTAL', 'RESOLVED');
create type public.career_source_kind as enum ('RESUME', 'OWNER_CONFIRMATION');
create type public.career_organization_kind as enum ('EMPLOYER', 'CLIENT', 'BOTH');
create type public.career_skill_category as enum ('FINANCE', 'ACCOUNTING', 'TECHNOLOGY', 'SYSTEM', 'DATA', 'LEADERSHIP', 'INDUSTRY');
create type public.career_project_kind as enum ('APPLICATION', 'TECHNICAL_PROJECT');
create type public.career_date_precision as enum ('MONTH', 'YEAR', 'UNKNOWN');
create type public.career_record_completeness as enum ('COMPLETE', 'PARTIAL');
create type public.career_entity_type as enum ('PROFILE', 'ORGANIZATION', 'TITLE', 'EXPERIENCE', 'EDUCATION', 'CREDENTIAL', 'SKILL', 'PROJECT', 'ACCOMPLISHMENT', 'METRIC');

create table public.career_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check (source_key ~ '^[A-Z0-9_]{3,80}$'),
  label text not null check (char_length(btrim(label)) between 2 and 160),
  source_kind public.career_source_kind not null,
  authority_status public.career_authority_status not null,
  authority_scope text[] not null default '{}'::text[] check (cardinality(authority_scope) <= 30),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, source_key)
);

create table public.career_profiles (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  professional_headline text not null check (char_length(btrim(professional_headline)) between 2 and 300),
  location_text text check (location_text is null or char_length(btrim(location_text)) between 2 and 200),
  professional_summary text not null check (char_length(btrim(professional_summary)) between 20 and 3000),
  years_experience_claim text check (years_experience_claim is null or years_experience_claim ~ '^[0-9]{1,2}\+$'),
  authority_status public.career_authority_status not null default 'RESOLVED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.career_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  canonical_name text not null check (char_length(btrim(canonical_name)) between 2 and 200),
  organization_kind public.career_organization_kind not null,
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);
create unique index career_organizations_owner_name_key on public.career_organizations (owner_id, lower(btrim(canonical_name)));

create table public.career_titles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  canonical_name text not null check (char_length(btrim(canonical_name)) between 2 and 200),
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);
create unique index career_titles_owner_name_key on public.career_titles (owner_id, lower(btrim(canonical_name)));

create table public.career_experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  organization_id uuid not null references public.career_organizations(id) on delete restrict,
  client_organization_id uuid references public.career_organizations(id) on delete restrict,
  title_id uuid references public.career_titles(id) on delete restrict,
  start_date date,
  start_precision public.career_date_precision not null default 'UNKNOWN',
  end_date date,
  end_precision public.career_date_precision not null default 'UNKNOWN',
  is_current boolean not null default false,
  location_text text check (location_text is null or char_length(btrim(location_text)) between 2 and 200),
  summary text check (summary is null or char_length(btrim(summary)) between 2 and 2000),
  completeness public.career_record_completeness not null default 'COMPLETE',
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key),
  check ((start_date is null and start_precision = 'UNKNOWN') or (start_date is not null and start_precision <> 'UNKNOWN')),
  check ((end_date is null and end_precision = 'UNKNOWN') or (end_date is not null and end_precision <> 'UNKNOWN')),
  check (not is_current or (end_date is null and end_precision = 'UNKNOWN')),
  check (start_date is null or end_date is null or end_date >= start_date),
  check (client_organization_id is null or client_organization_id <> organization_id),
  check (completeness = 'PARTIAL' or title_id is not null)
);
create index career_experiences_owner_dates_idx on public.career_experiences (owner_id, start_date desc nulls last);

create table public.career_education (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  degree_name text not null check (char_length(btrim(degree_name)) between 2 and 200),
  field_of_study text check (field_of_study is null or char_length(btrim(field_of_study)) between 2 and 200),
  institution_name text not null check (char_length(btrim(institution_name)) between 2 and 200),
  completed_on date,
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);

create table public.career_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  credential_name text not null check (char_length(btrim(credential_name)) between 2 and 200),
  credential_status text not null check (credential_status in ('ACTIVE', 'INACTIVE', 'COMPLETED', 'CANDIDATE')),
  issuing_organization text check (issuing_organization is null or char_length(btrim(issuing_organization)) between 2 and 200),
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);

create table public.career_skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  canonical_name text not null check (char_length(btrim(canonical_name)) between 1 and 160),
  category public.career_skill_category not null,
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);
create unique index career_skills_owner_name_category_key on public.career_skills (owner_id, lower(btrim(canonical_name)), category);

create table public.career_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,100}$'),
  canonical_name text not null check (char_length(btrim(canonical_name)) between 2 and 200),
  project_kind public.career_project_kind not null,
  experience_id uuid references public.career_experiences(id) on delete set null,
  client_organization_id uuid references public.career_organizations(id) on delete restrict,
  summary text not null check (char_length(btrim(summary)) between 10 and 3000),
  business_challenge text check (business_challenge is null or char_length(btrim(business_challenge)) between 5 and 3000),
  architecture text check (architecture is null or char_length(btrim(architecture)) between 5 and 3000),
  impact text check (impact is null or char_length(btrim(impact)) between 5 and 3000),
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);
create unique index career_projects_owner_name_key on public.career_projects (owner_id, lower(btrim(canonical_name)));

create table public.career_accomplishments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,120}$'),
  experience_id uuid references public.career_experiences(id) on delete cascade,
  project_id uuid references public.career_projects(id) on delete cascade,
  category text not null check (category in ('FINANCE', 'ACCOUNTING', 'AUTOMATION', 'CONTROLS', 'LEADERSHIP', 'REPORTING', 'OPERATIONS', 'TECHNOLOGY')),
  statement text not null check (char_length(btrim(statement)) between 10 and 3000),
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key),
  check (experience_id is not null or project_id is not null)
);

create table public.career_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null check (canonical_key ~ '^[A-Z0-9_]{2,120}$'),
  accomplishment_id uuid not null references public.career_accomplishments(id) on delete cascade,
  metric_type text not null check (metric_type ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  value_numeric numeric,
  value_text text check (value_text is null or char_length(btrim(value_text)) between 1 and 300),
  before_numeric numeric,
  before_text text check (before_text is null or char_length(btrim(before_text)) between 1 and 300),
  after_numeric numeric,
  after_text text check (after_text is null or char_length(btrim(after_text)) between 1 and 300),
  unit text check (unit is null or unit ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  qualifier text check (qualifier is null or qualifier in ('EXACT', 'MINIMUM', 'APPROXIMATE', 'UNDER', 'REDUCTION', 'IMPROVEMENT')),
  scope_text text check (scope_text is null or char_length(btrim(scope_text)) between 2 and 500),
  authority_status public.career_authority_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key),
  check (num_nonnulls(value_numeric, value_text, before_numeric, before_text, after_numeric, after_text) > 0)
);

create table public.career_experience_skills (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.career_experiences(id) on delete cascade,
  skill_id uuid not null references public.career_skills(id) on delete cascade,
  primary key (experience_id, skill_id)
);

create table public.career_project_skills (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.career_projects(id) on delete cascade,
  skill_id uuid not null references public.career_skills(id) on delete cascade,
  primary key (project_id, skill_id)
);

create table public.career_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entity_type public.career_entity_type not null check (entity_type in ('ORGANIZATION', 'TITLE', 'SKILL', 'PROJECT')),
  entity_id uuid not null,
  alias_text text not null check (char_length(btrim(alias_text)) between 1 and 200),
  created_at timestamptz not null default now()
);
create unique index career_aliases_owner_target_alias_key on public.career_aliases (owner_id, entity_type, entity_id, lower(btrim(alias_text)));

create table public.career_provenance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null references public.career_sources(id) on delete restrict,
  entity_type public.career_entity_type not null,
  entity_id uuid not null,
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]{1,79}$'),
  source_page smallint not null default 0 check (source_page between 0 and 1000),
  source_wording text not null check (char_length(btrim(source_wording)) between 1 and 5000),
  source_role public.career_authority_status not null,
  resolution_note text check (resolution_note is null or char_length(btrim(resolution_note)) between 2 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_id, entity_type, entity_id, field_name, source_page)
);

create function public.touch_career_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger career_profiles_touch_updated_at before update on public.career_profiles for each row execute function public.touch_career_updated_at();
create trigger career_organizations_touch_updated_at before update on public.career_organizations for each row execute function public.touch_career_updated_at();
create trigger career_titles_touch_updated_at before update on public.career_titles for each row execute function public.touch_career_updated_at();
create trigger career_experiences_touch_updated_at before update on public.career_experiences for each row execute function public.touch_career_updated_at();
create trigger career_education_touch_updated_at before update on public.career_education for each row execute function public.touch_career_updated_at();
create trigger career_credentials_touch_updated_at before update on public.career_credentials for each row execute function public.touch_career_updated_at();
create trigger career_skills_touch_updated_at before update on public.career_skills for each row execute function public.touch_career_updated_at();
create trigger career_projects_touch_updated_at before update on public.career_projects for each row execute function public.touch_career_updated_at();
create trigger career_accomplishments_touch_updated_at before update on public.career_accomplishments for each row execute function public.touch_career_updated_at();
create trigger career_metrics_touch_updated_at before update on public.career_metrics for each row execute function public.touch_career_updated_at();
create trigger career_provenance_touch_updated_at before update on public.career_provenance for each row execute function public.touch_career_updated_at();

create function public.validate_career_experience_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.career_organizations where id = new.organization_id and owner_id = new.owner_id) then
    raise exception 'Career experience organization must belong to the owner';
  end if;
  if new.client_organization_id is not null and not exists (select 1 from public.career_organizations where id = new.client_organization_id and owner_id = new.owner_id) then
    raise exception 'Career experience client must belong to the owner';
  end if;
  if new.title_id is not null and not exists (select 1 from public.career_titles where id = new.title_id and owner_id = new.owner_id) then
    raise exception 'Career experience title must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_experiences_validate_relations before insert or update on public.career_experiences for each row execute function public.validate_career_experience_relations();

create function public.validate_career_project_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.experience_id is not null and not exists (select 1 from public.career_experiences where id = new.experience_id and owner_id = new.owner_id) then
    raise exception 'Career project experience must belong to the owner';
  end if;
  if new.client_organization_id is not null and not exists (select 1 from public.career_organizations where id = new.client_organization_id and owner_id = new.owner_id) then
    raise exception 'Career project client must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_projects_validate_relations before insert or update on public.career_projects for each row execute function public.validate_career_project_relations();

create function public.validate_career_accomplishment_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.experience_id is not null and not exists (select 1 from public.career_experiences where id = new.experience_id and owner_id = new.owner_id) then
    raise exception 'Career accomplishment experience must belong to the owner';
  end if;
  if new.project_id is not null and not exists (select 1 from public.career_projects where id = new.project_id and owner_id = new.owner_id) then
    raise exception 'Career accomplishment project must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_accomplishments_validate_relations before insert or update on public.career_accomplishments for each row execute function public.validate_career_accomplishment_relations();

create function public.validate_career_metric_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.career_accomplishments where id = new.accomplishment_id and owner_id = new.owner_id) then
    raise exception 'Career metric accomplishment must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_metrics_validate_relation before insert or update on public.career_metrics for each row execute function public.validate_career_metric_relation();

create function public.validate_career_experience_skill_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.career_skills where id = new.skill_id and owner_id = new.owner_id) then
    raise exception 'Career skill must belong to the relationship owner';
  end if;
  if not exists (select 1 from public.career_experiences where id = new.experience_id and owner_id = new.owner_id) then
    raise exception 'Career experience must belong to the relationship owner';
  end if;
  return new;
end;
$$;
create trigger career_experience_skills_validate before insert or update on public.career_experience_skills for each row execute function public.validate_career_experience_skill_relation();

create function public.validate_career_project_skill_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.career_skills where id = new.skill_id and owner_id = new.owner_id) then
    raise exception 'Career skill must belong to the relationship owner';
  end if;
  if not exists (select 1 from public.career_projects where id = new.project_id and owner_id = new.owner_id) then
    raise exception 'Career project must belong to the relationship owner';
  end if;
  return new;
end;
$$;
create trigger career_project_skills_validate before insert or update on public.career_project_skills for each row execute function public.validate_career_project_skill_relation();

create function public.career_entity_belongs_to_owner(entity_kind public.career_entity_type, target_id uuid, target_owner uuid)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  return case entity_kind
    when 'PROFILE' then exists (select 1 from public.career_profiles where owner_id = target_id and owner_id = target_owner)
    when 'ORGANIZATION' then exists (select 1 from public.career_organizations where id = target_id and owner_id = target_owner)
    when 'TITLE' then exists (select 1 from public.career_titles where id = target_id and owner_id = target_owner)
    when 'EXPERIENCE' then exists (select 1 from public.career_experiences where id = target_id and owner_id = target_owner)
    when 'EDUCATION' then exists (select 1 from public.career_education where id = target_id and owner_id = target_owner)
    when 'CREDENTIAL' then exists (select 1 from public.career_credentials where id = target_id and owner_id = target_owner)
    when 'SKILL' then exists (select 1 from public.career_skills where id = target_id and owner_id = target_owner)
    when 'PROJECT' then exists (select 1 from public.career_projects where id = target_id and owner_id = target_owner)
    when 'ACCOMPLISHMENT' then exists (select 1 from public.career_accomplishments where id = target_id and owner_id = target_owner)
    when 'METRIC' then exists (select 1 from public.career_metrics where id = target_id and owner_id = target_owner)
    else false
  end;
end;
$$;

create function public.validate_career_alias_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.career_entity_belongs_to_owner(new.entity_type, new.entity_id, new.owner_id) then
    raise exception 'Career alias target must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_aliases_validate_target before insert or update on public.career_aliases for each row execute function public.validate_career_alias_target();

create function public.validate_career_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.career_sources where id = new.source_id and owner_id = new.owner_id) then
    raise exception 'Career provenance source must belong to the owner';
  end if;
  if not public.career_entity_belongs_to_owner(new.entity_type, new.entity_id, new.owner_id) then
    raise exception 'Career provenance target must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_provenance_validate before insert or update on public.career_provenance for each row execute function public.validate_career_provenance();

do $$
declare
  career_table text;
begin
  foreach career_table in array array[
    'career_sources', 'career_profiles', 'career_organizations', 'career_titles',
    'career_experiences', 'career_education', 'career_credentials', 'career_skills',
    'career_projects', 'career_accomplishments', 'career_metrics',
    'career_experience_skills', 'career_project_skills', 'career_aliases', 'career_provenance'
  ] loop
    execute format('alter table public.%I enable row level security', career_table);
    execute format('revoke all on table public.%I from anon, authenticated', career_table);
    execute format('grant select on table public.%I to authenticated', career_table);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = owner_id)', 'owners read own ' || career_table, career_table);
  end loop;
end;
$$;

revoke all on function public.career_entity_belongs_to_owner(public.career_entity_type, uuid, uuid) from public, anon, authenticated;
