create type public.career_fact_status as enum ('CONFIRMED', 'NEEDS_REVIEW', 'CONFLICT', 'REJECTED');
create type public.career_candidate_classification as enum ('SUPPORTED_BY_BOTH', 'SUPPORTED_BY_RESUME_A', 'SUPPORTED_BY_RESUME_B', 'POTENTIAL_CONFLICT');
create type public.career_dependency_freshness as enum ('CURRENT', 'STALE');

alter table public.career_sources
  add column intake_identity text check (intake_identity is null or intake_identity in ('RESUME_A', 'RESUME_B', 'OWNER_STATEMENT'));
update public.career_sources set intake_identity = case source_key
  when 'KF_RESUME' then 'RESUME_A'
  when 'SECONDARY_RESUME' then 'RESUME_B'
  when 'OWNER_RESOLUTIONS' then 'OWNER_STATEMENT'
  else null
end;
create unique index career_sources_owner_intake_identity_key
  on public.career_sources (owner_id, intake_identity) where intake_identity is not null;

create table public.career_source_extractions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid not null references public.career_sources(id) on delete cascade,
  source_identity text not null check (source_identity in ('RESUME_A', 'RESUME_B')),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  extraction_method text not null check (extraction_method in ('PERSISTED_REVIEWED_IMPORT', 'DETERMINISTIC', 'AI_STRUCTURED')),
  extraction_status text not null check (extraction_status in ('SUCCEEDED', 'FAILED')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  structured_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_summary) = 'object' and pg_column_size(structured_summary) <= 1048576),
  extracted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_id, source_sha256, schema_version)
);

create table public.career_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  entity_type public.career_entity_type not null,
  entity_id uuid not null,
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]{1,79}$'),
  fact_type text not null check (fact_type ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  normalized_claim text not null check (char_length(btrim(normalized_claim)) between 1 and 5000),
  current_value jsonb not null,
  status public.career_fact_status not null,
  confirmation_method text check (confirmation_method is null or confirmation_method in ('AUTO_CONFIRMED_SOURCE_AGREEMENT', 'OWNER_CONFIRMED', 'CONTROLLED_IMPORT')),
  version_number integer not null default 1 check (version_number > 0),
  owner_confirmed_at timestamptz,
  first_added_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  unique (owner_id, entity_type, entity_id, field_name),
  check (status <> 'CONFIRMED' or confirmation_method is not null)
);

create table public.career_candidate_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  extraction_id uuid not null references public.career_source_extractions(id) on delete cascade,
  source_id uuid not null references public.career_sources(id) on delete cascade,
  career_fact_id uuid references public.career_facts(id) on delete set null,
  group_key text not null check (char_length(btrim(group_key)) between 3 and 500),
  entity_type public.career_entity_type not null,
  entity_id uuid not null,
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]{1,79}$'),
  normalized_claim text not null check (char_length(btrim(normalized_claim)) between 1 and 5000),
  extracted_value jsonb not null,
  source_reference text not null check (char_length(btrim(source_reference)) between 2 and 500),
  extraction_method text not null check (extraction_method in ('PERSISTED_REVIEWED_IMPORT', 'DETERMINISTIC', 'AI_STRUCTURED')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  classification public.career_candidate_classification not null,
  status public.career_fact_status not null,
  confirmation_method text check (confirmation_method is null or confirmation_method in ('AUTO_CONFIRMED_SOURCE_AGREEMENT', 'OWNER_CONFIRMED', 'CONTROLLED_IMPORT')),
  is_material boolean not null default false,
  review_reason text check (review_reason is null or char_length(btrim(review_reason)) between 2 and 1000),
  extracted_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (extraction_id, entity_type, entity_id, field_name, normalized_claim),
  check (status <> 'CONFIRMED' or confirmation_method is not null),
  check (status not in ('NEEDS_REVIEW', 'CONFLICT') or review_reason is not null)
);

create table public.career_fact_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  career_fact_id uuid not null references public.career_facts(id) on delete cascade,
  candidate_fact_id uuid references public.career_candidate_facts(id) on delete set null,
  source_id uuid not null references public.career_sources(id) on delete restrict,
  source_reference text not null check (char_length(btrim(source_reference)) between 2 and 500),
  confirmation_method text not null check (confirmation_method in ('AUTO_CONFIRMED_SOURCE_AGREEMENT', 'OWNER_CONFIRMED', 'CONTROLLED_IMPORT')),
  first_added_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  unique (owner_id, career_fact_id, source_id, confirmation_method)
);

create table public.career_fact_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  career_fact_id uuid not null references public.career_facts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  previous_value jsonb,
  new_value jsonb not null,
  previous_status public.career_fact_status,
  new_status public.career_fact_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  change_source text not null check (change_source in ('OWNER_EDIT', 'OWNER_REVIEW', 'AUTO_CONFIRMATION', 'CONTROLLED_IMPORT')),
  reason text check (reason is null or char_length(btrim(reason)) between 2 and 1000),
  unique (career_fact_id, version_number)
);

create table public.career_fact_dependencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  career_fact_id uuid not null references public.career_facts(id) on delete cascade,
  dependent_kind text not null check (dependent_kind in ('JOB_MATCH', 'RESUME_VERSION', 'OUTREACH_DRAFT')),
  dependent_id uuid not null,
  lifecycle_state text not null check (lifecycle_state in ('DRAFT', 'UNSENT', 'SENT', 'PUBLISHED')),
  freshness public.career_dependency_freshness not null default 'CURRENT',
  stale_at timestamptz,
  stale_reason text check (stale_reason is null or char_length(btrim(stale_reason)) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, career_fact_id, dependent_kind, dependent_id)
);

create index career_candidate_facts_owner_review_idx on public.career_candidate_facts (owner_id, status, created_at);
create index career_candidate_facts_group_idx on public.career_candidate_facts (owner_id, group_key);
create index career_fact_versions_owner_changed_idx on public.career_fact_versions (owner_id, changed_at desc);
create index career_fact_dependencies_fact_idx on public.career_fact_dependencies (owner_id, career_fact_id, freshness);

create function public.validate_career_fact_target()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.career_entity_belongs_to_owner(new.entity_type, new.entity_id, new.owner_id) then
    raise exception 'Career fact target must belong to the owner';
  end if;
  return new;
end;
$$;
create trigger career_facts_validate_target before insert or update on public.career_facts for each row execute function public.validate_career_fact_target();
create trigger career_candidate_facts_validate_target before insert or update on public.career_candidate_facts for each row execute function public.validate_career_fact_target();

create function public.prepare_career_fact_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.current_value is distinct from new.current_value
    or old.normalized_claim is distinct from new.normalized_claim
    or old.status is distinct from new.status
    or old.confirmation_method is distinct from new.confirmation_method then
    new.version_number = old.version_number + 1;
    new.last_changed_at = now();
  end if;
  return new;
end;
$$;
create trigger career_facts_prepare_version before update on public.career_facts for each row execute function public.prepare_career_fact_update();

create function public.capture_career_fact_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  change_kind text := coalesce(nullif(current_setting('kym.career_change_source', true), ''), case when auth.uid() = new.owner_id then 'OWNER_EDIT' else 'CONTROLLED_IMPORT' end);
  change_reason text := nullif(current_setting('kym.career_change_reason', true), '');
begin
  if new.version_number = old.version_number then return new; end if;
  insert into public.career_fact_versions (owner_id, career_fact_id, version_number, previous_value, new_value, previous_status, new_status, changed_by, change_source, reason)
  values (new.owner_id, new.id, new.version_number, old.current_value, new.current_value, old.status, new.status, auth.uid(), change_kind, change_reason);
  return new;
end;
$$;
create trigger career_facts_capture_version after update on public.career_facts for each row execute function public.capture_career_fact_version();

create function public.mark_career_fact_dependencies_stale()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.current_value is not distinct from new.current_value then return new; end if;
  update public.career_fact_dependencies
  set freshness = 'STALE', stale_at = now(), stale_reason = 'Authoritative career fact changed.', updated_at = now()
  where owner_id = new.owner_id and career_fact_id = new.id and freshness = 'CURRENT' and lifecycle_state in ('DRAFT', 'UNSENT');
  return new;
end;
$$;
create trigger career_facts_mark_dependencies_stale after update on public.career_facts for each row execute function public.mark_career_fact_dependencies_stale();

do $$
declare
  target record;
begin
  for target in select * from (values
    ('PROFILE', 'career_profiles', 'owner_id'), ('ORGANIZATION', 'career_organizations', 'id'),
    ('TITLE', 'career_titles', 'id'), ('EXPERIENCE', 'career_experiences', 'id'),
    ('EDUCATION', 'career_education', 'id'), ('CREDENTIAL', 'career_credentials', 'id'),
    ('SKILL', 'career_skills', 'id'), ('PROJECT', 'career_projects', 'id'),
    ('ACCOMPLISHMENT', 'career_accomplishments', 'id'), ('METRIC', 'career_metrics', 'id')
  ) as valueset(entity_type, table_name, id_column)
  loop
    execute format($sql$
      insert into public.career_facts (owner_id, entity_type, entity_id, field_name, fact_type, normalized_claim, current_value, status, confirmation_method, owner_confirmed_at, first_added_at, last_changed_at)
      select t.owner_id, %L::public.career_entity_type, t.%I, value.key,
        left(upper(%L || '_' || regexp_replace(value.key, '[^a-zA-Z0-9]+', '_', 'g')), 80),
        left(lower(regexp_replace(value.value::text, '\s+', ' ', 'g')), 5000), value.value,
        'CONFIRMED'::public.career_fact_status,
        case when t.authority_status = 'RESOLVED' then 'OWNER_CONFIRMED' else 'CONTROLLED_IMPORT' end,
        case when t.authority_status = 'RESOLVED' then t.updated_at else null end,
        t.created_at, t.updated_at
      from public.%I t
      cross join lateral jsonb_each(to_jsonb(t) - array['id','owner_id','canonical_key','authority_status','created_at','updated_at']) value
      where value.value <> 'null'::jsonb
      on conflict (owner_id, entity_type, entity_id, field_name) do nothing
    $sql$, target.entity_type, target.id_column, target.entity_type, target.table_name);
  end loop;
end;
$$;

insert into public.career_fact_versions (owner_id, career_fact_id, version_number, new_value, new_status, change_source, reason)
select owner_id, id, 1, current_value, status, 'CONTROLLED_IMPORT', 'Initial Gate 6A authoritative fact snapshot.'
from public.career_facts
on conflict (career_fact_id, version_number) do nothing;

insert into public.career_source_extractions (owner_id, source_id, source_identity, source_sha256, extraction_method, extraction_status, candidate_count, structured_summary, extracted_at)
select s.owner_id, s.id, s.intake_identity, s.content_sha256, 'PERSISTED_REVIEWED_IMPORT', 'SUCCEEDED', count(p.id)::integer,
  jsonb_build_object('sourceKey', s.source_key, 'reviewedProvenanceRecords', count(p.id), 'reusedExistingExtraction', true),
  coalesce(max(p.created_at), s.reviewed_at)
from public.career_sources s
left join public.career_provenance p on p.source_id = s.id and p.owner_id = s.owner_id
where s.intake_identity in ('RESUME_A', 'RESUME_B') and s.content_sha256 is not null
group by s.owner_id, s.id, s.intake_identity, s.content_sha256, s.source_key, s.reviewed_at;

insert into public.career_candidate_facts (
  owner_id, extraction_id, source_id, career_fact_id, group_key, entity_type, entity_id, field_name,
  normalized_claim, extracted_value, source_reference, extraction_method, classification, status,
  confirmation_method, is_material, review_reason, extracted_at, resolved_at
)
select p.owner_id, extraction.id, p.source_id, fact.id,
  p.entity_type::text || ':' || p.entity_id::text || ':' || p.field_name,
  p.entity_type, p.entity_id, p.field_name,
  left(lower(regexp_replace(p.source_wording, '[^a-zA-Z0-9]+', ' ', 'g')), 5000),
  jsonb_build_object('sourceWording', p.source_wording, 'sourcePage', p.source_page),
  extraction.source_identity || case when p.source_page > 0 then ' · page ' || p.source_page::text else ' · reviewed source' end,
  'PERSISTED_REVIEWED_IMPORT',
  case extraction.source_identity when 'RESUME_A' then 'SUPPORTED_BY_RESUME_A'::public.career_candidate_classification else 'SUPPORTED_BY_RESUME_B'::public.career_candidate_classification end,
  case
    when p.resolution_note is not null then 'CONFIRMED'::public.career_fact_status
    when extraction.source_identity = 'RESUME_A' then 'CONFIRMED'::public.career_fact_status
    else 'NEEDS_REVIEW'::public.career_fact_status
  end,
  case
    when p.resolution_note is not null then 'OWNER_CONFIRMED'
    when extraction.source_identity = 'RESUME_A' then 'CONTROLLED_IMPORT'
    else null
  end,
  extraction.source_identity = 'RESUME_B',
  case when extraction.source_identity = 'RESUME_B' and p.resolution_note is null
    then 'Unique Resume B claim requires owner review before becoming authoritative.' else null end,
  p.created_at,
  case when p.resolution_note is not null then p.updated_at else null end
from public.career_provenance p
join public.career_source_extractions extraction on extraction.source_id = p.source_id and extraction.owner_id = p.owner_id
left join public.career_facts fact on fact.owner_id = p.owner_id and fact.entity_type = p.entity_type and fact.entity_id = p.entity_id and fact.field_name = p.field_name
on conflict (extraction_id, entity_type, entity_id, field_name, normalized_claim) do nothing;

-- Reuse the reviewed source records to identify exact low-risk technologies that are
-- present in the authoritative Resume A extraction and in Resume B source wording.
-- No model call is used and no credential/date/metric/title is eligible here.
with dual_source_skills as (
  select skill.owner_id, skill.id as skill_id, skill.canonical_key, skill.canonical_name,
    fact.id as fact_id, resume_a.id as resume_a_source_id, extract_a.id as extract_a_id,
    resume_b.id as resume_b_source_id, extract_b.id as extract_b_id,
    min(provenance_b.source_page) as resume_b_page
  from public.career_skills skill
  join public.career_facts fact on fact.owner_id = skill.owner_id and fact.entity_type = 'SKILL' and fact.entity_id = skill.id and fact.field_name = 'canonical_name'
  join public.career_sources resume_a on resume_a.owner_id = skill.owner_id and resume_a.intake_identity = 'RESUME_A'
  join public.career_source_extractions extract_a on extract_a.owner_id = skill.owner_id and extract_a.source_id = resume_a.id
  join public.career_sources resume_b on resume_b.owner_id = skill.owner_id and resume_b.intake_identity = 'RESUME_B'
  join public.career_source_extractions extract_b on extract_b.owner_id = skill.owner_id and extract_b.source_id = resume_b.id
  join public.career_provenance provenance_b on provenance_b.owner_id = skill.owner_id and provenance_b.source_id = resume_b.id
    and to_tsvector('simple', provenance_b.source_wording) @@ plainto_tsquery('simple', skill.canonical_name)
  where skill.authority_status in ('AUTHORITATIVE','RESOLVED')
    and skill.category in ('TECHNOLOGY','SYSTEM','DATA')
    and fact.confirmation_method <> 'OWNER_CONFIRMED'
  group by skill.owner_id, skill.id, skill.canonical_key, skill.canonical_name, fact.id,
    resume_a.id, extract_a.id, resume_b.id, extract_b.id
), inserted_candidates as (
  insert into public.career_candidate_facts (
    owner_id, extraction_id, source_id, career_fact_id, group_key, entity_type, entity_id,
    field_name, normalized_claim, extracted_value, source_reference, extraction_method,
    classification, status, confirmation_method, is_material, extracted_at, resolved_at
  )
  select facts.owner_id,
    case source_identity when 'RESUME_A' then facts.extract_a_id else facts.extract_b_id end,
    case source_identity when 'RESUME_A' then facts.resume_a_source_id else facts.resume_b_source_id end,
    facts.fact_id, 'SKILL:' || facts.canonical_key || ':canonical_name', 'SKILL', facts.skill_id,
    'canonical_name', lower(facts.canonical_name), to_jsonb(facts.canonical_name),
    case source_identity when 'RESUME_A' then 'RESUME_A · reviewed structured skill extraction'
      else 'RESUME_B · page ' || facts.resume_b_page::text end,
    'DETERMINISTIC', 'SUPPORTED_BY_BOTH', 'CONFIRMED', 'AUTO_CONFIRMED_SOURCE_AGREEMENT',
    false, now(), now()
  from dual_source_skills facts cross join (values ('RESUME_A'), ('RESUME_B')) identity(source_identity)
  on conflict (extraction_id, entity_type, entity_id, field_name, normalized_claim) do update set
    classification = 'SUPPORTED_BY_BOTH', status = 'CONFIRMED',
    confirmation_method = 'AUTO_CONFIRMED_SOURCE_AGREEMENT', review_reason = null, resolved_at = now(), updated_at = now()
  returning career_fact_id
)
update public.career_facts fact set confirmation_method = 'AUTO_CONFIRMED_SOURCE_AGREEMENT'
where fact.id in (select career_fact_id from inserted_candidates)
  and fact.confirmation_method <> 'OWNER_CONFIRMED';

-- Resume B's 20+ claim differs from the already authoritative 23+ claim. The
-- owner-confirmed current value is never changed; the alternate becomes a review exception.
insert into public.career_candidate_facts (
  owner_id, extraction_id, source_id, career_fact_id, group_key, entity_type, entity_id,
  field_name, normalized_claim, extracted_value, source_reference, extraction_method,
  classification, status, confirmation_method, is_material, review_reason, extracted_at
)
select profile.owner_id, extraction.id, source.id, fact.id, 'PROFILE:years_experience_claim',
  'PROFILE', profile.owner_id, 'years_experience_claim', '20+', to_jsonb('20+'::text),
  'RESUME_B · page 1', 'PERSISTED_REVIEWED_IMPORT', 'POTENTIAL_CONFLICT', 'CONFLICT', null,
  true, 'Resume B states 20+ years while the authoritative profile states ' || profile.years_experience_claim || '; owner review is required and the confirmed value remains protected.', now()
from public.career_profiles profile
join public.career_facts fact on fact.owner_id = profile.owner_id and fact.entity_type = 'PROFILE'
  and fact.entity_id = profile.owner_id and fact.field_name = 'years_experience_claim'
join public.career_sources source on source.owner_id = profile.owner_id and source.intake_identity = 'RESUME_B'
join public.career_source_extractions extraction on extraction.owner_id = profile.owner_id and extraction.source_id = source.id
where profile.years_experience_claim is not null and profile.years_experience_claim <> '20+'
on conflict (extraction_id, entity_type, entity_id, field_name, normalized_claim) do nothing;

update public.career_source_extractions extraction set candidate_count = counts.total, updated_at = now()
from (select extraction_id, count(*)::integer as total from public.career_candidate_facts group by extraction_id) counts
where extraction.id = counts.extraction_id;

insert into public.career_fact_sources (owner_id, career_fact_id, candidate_fact_id, source_id, source_reference, confirmation_method)
select candidate.owner_id, candidate.career_fact_id, candidate.id, candidate.source_id, candidate.source_reference,
  coalesce(candidate.confirmation_method, 'CONTROLLED_IMPORT')
from public.career_candidate_facts candidate
where candidate.career_fact_id is not null and candidate.confirmation_method is not null
on conflict (owner_id, career_fact_id, source_id, confirmation_method) do update set last_changed_at = now();

create function public.sync_career_fact_from_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_value jsonb := to_jsonb(old);
  new_value jsonb := to_jsonb(new);
  target_type public.career_entity_type := tg_argv[0]::public.career_entity_type;
  target_id uuid := case when tg_argv[0] = 'PROFILE' then new.owner_id else (to_jsonb(new) ->> 'id')::uuid end;
  changed_field text;
  actor uuid := auth.uid();
begin
  perform set_config('kym.career_change_source', case when actor = new.owner_id then 'OWNER_EDIT' else 'CONTROLLED_IMPORT' end, true);
  perform set_config('kym.career_change_reason', case when actor = new.owner_id then 'Owner edited the authoritative career record.' else 'Controlled career import updated the authoritative record.' end, true);
  for changed_field in select key from jsonb_object_keys(new_value) key
    where key not in ('id','owner_id','canonical_key','authority_status','created_at','updated_at')
      and old_value -> key is distinct from new_value -> key
  loop
    insert into public.career_facts (owner_id, entity_type, entity_id, field_name, fact_type, normalized_claim, current_value, status, confirmation_method, owner_confirmed_at)
    values (new.owner_id, target_type, target_id, changed_field,
      left(upper(target_type::text || '_' || regexp_replace(changed_field, '[^a-zA-Z0-9]+', '_', 'g')), 80),
      left(lower(regexp_replace((new_value -> changed_field)::text, '\s+', ' ', 'g')), 5000),
      new_value -> changed_field, 'CONFIRMED', case when actor = new.owner_id then 'OWNER_CONFIRMED' else 'CONTROLLED_IMPORT' end,
      case when actor = new.owner_id then now() else null end)
    on conflict (owner_id, entity_type, entity_id, field_name) do update set
      normalized_claim = excluded.normalized_claim, current_value = excluded.current_value, status = 'CONFIRMED',
      confirmation_method = excluded.confirmation_method,
      owner_confirmed_at = case when actor = new.owner_id then now() else public.career_facts.owner_confirmed_at end
    where actor = new.owner_id or public.career_facts.confirmation_method <> 'OWNER_CONFIRMED';
  end loop;
  return new;
end;
$$;

create trigger career_profiles_sync_facts after update on public.career_profiles for each row execute function public.sync_career_fact_from_record('PROFILE');
create trigger career_organizations_sync_facts after update on public.career_organizations for each row execute function public.sync_career_fact_from_record('ORGANIZATION');
create trigger career_titles_sync_facts after update on public.career_titles for each row execute function public.sync_career_fact_from_record('TITLE');
create trigger career_experiences_sync_facts after update on public.career_experiences for each row execute function public.sync_career_fact_from_record('EXPERIENCE');
create trigger career_education_sync_facts after update on public.career_education for each row execute function public.sync_career_fact_from_record('EDUCATION');
create trigger career_credentials_sync_facts after update on public.career_credentials for each row execute function public.sync_career_fact_from_record('CREDENTIAL');
create trigger career_skills_sync_facts after update on public.career_skills for each row execute function public.sync_career_fact_from_record('SKILL');
create trigger career_projects_sync_facts after update on public.career_projects for each row execute function public.sync_career_fact_from_record('PROJECT');
create trigger career_accomplishments_sync_facts after update on public.career_accomplishments for each row execute function public.sync_career_fact_from_record('ACCOMPLISHMENT');
create trigger career_metrics_sync_facts after update on public.career_metrics for each row execute function public.sync_career_fact_from_record('METRIC');

create function public.protect_owner_confirmed_career_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_type public.career_entity_type := tg_argv[0]::public.career_entity_type;
  target_id uuid := case when tg_argv[0] = 'PROFILE' then new.owner_id else (to_jsonb(new) ->> 'id')::uuid end;
  changed_field text;
begin
  if auth.uid() = new.owner_id then return new; end if;
  for changed_field in select key from jsonb_object_keys(to_jsonb(new)) key
    where key not in ('id','owner_id','canonical_key','authority_status','created_at','updated_at')
      and to_jsonb(old) -> key is distinct from to_jsonb(new) -> key
  loop
    if exists (
      select 1 from public.career_facts fact
      where fact.owner_id = new.owner_id and fact.entity_type = target_type and fact.entity_id = target_id
        and fact.field_name = changed_field and fact.confirmation_method = 'OWNER_CONFIRMED'
    ) then
      raise exception 'Owner-confirmed career facts require owner review before replacement';
    end if;
  end loop;
  return new;
end;
$$;

create trigger career_profiles_protect_owner_facts before update on public.career_profiles for each row execute function public.protect_owner_confirmed_career_record('PROFILE');
create trigger career_organizations_protect_owner_facts before update on public.career_organizations for each row execute function public.protect_owner_confirmed_career_record('ORGANIZATION');
create trigger career_titles_protect_owner_facts before update on public.career_titles for each row execute function public.protect_owner_confirmed_career_record('TITLE');
create trigger career_experiences_protect_owner_facts before update on public.career_experiences for each row execute function public.protect_owner_confirmed_career_record('EXPERIENCE');
create trigger career_education_protect_owner_facts before update on public.career_education for each row execute function public.protect_owner_confirmed_career_record('EDUCATION');
create trigger career_credentials_protect_owner_facts before update on public.career_credentials for each row execute function public.protect_owner_confirmed_career_record('CREDENTIAL');
create trigger career_skills_protect_owner_facts before update on public.career_skills for each row execute function public.protect_owner_confirmed_career_record('SKILL');
create trigger career_projects_protect_owner_facts before update on public.career_projects for each row execute function public.protect_owner_confirmed_career_record('PROJECT');
create trigger career_accomplishments_protect_owner_facts before update on public.career_accomplishments for each row execute function public.protect_owner_confirmed_career_record('ACCOMPLISHMENT');
create trigger career_metrics_protect_owner_facts before update on public.career_metrics for each row execute function public.protect_owner_confirmed_career_record('METRIC');

create function public.resolve_career_candidate(review_candidate_id uuid, resolution_action text, edited_claim text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  candidate public.career_candidate_facts%rowtype;
  fact public.career_facts%rowtype;
  final_value jsonb;
  final_claim text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if resolution_action not in ('APPROVE', 'EDIT', 'REJECT') then raise exception 'Invalid review action'; end if;
  select * into candidate from public.career_candidate_facts where id = review_candidate_id and owner_id = actor for update;
  if not found then raise exception 'Review item not found'; end if;

  if resolution_action = 'REJECT' then
    update public.career_candidate_facts set status = 'REJECTED', confirmation_method = 'OWNER_CONFIRMED', review_reason = 'Rejected by owner.', resolved_at = now(), updated_at = now()
    where id = candidate.id;
    return jsonb_build_object('resolved', true, 'status', 'REJECTED');
  end if;

  if resolution_action = 'EDIT' and (edited_claim is null or char_length(btrim(edited_claim)) not between 2 and 2000) then
    raise exception 'Edited claim must contain between 2 and 2000 characters';
  end if;
  final_value := case when resolution_action = 'EDIT' then jsonb_build_object('ownerConfirmedClaim', btrim(edited_claim)) else candidate.extracted_value end;
  final_claim := case when resolution_action = 'EDIT' then lower(regexp_replace(btrim(edited_claim), '\s+', ' ', 'g')) else candidate.normalized_claim end;

  update public.career_candidate_facts set status = 'REJECTED', confirmation_method = 'OWNER_CONFIRMED', review_reason = 'Alternate source claim was not selected by owner.', resolved_at = now(), updated_at = now()
  where owner_id = actor and group_key = candidate.group_key and id <> candidate.id and status in ('NEEDS_REVIEW', 'CONFLICT');
  update public.career_candidate_facts set normalized_claim = final_claim, extracted_value = final_value, status = 'CONFIRMED', confirmation_method = 'OWNER_CONFIRMED', review_reason = null, resolved_at = now(), updated_at = now()
  where id = candidate.id;

  perform set_config('kym.career_change_source', 'OWNER_REVIEW', true);
  perform set_config('kym.career_change_reason', case when resolution_action = 'EDIT' then 'Owner edited and confirmed a candidate career fact.' else 'Owner approved a candidate career fact.' end, true);
  if candidate.career_fact_id is null then
    insert into public.career_facts (owner_id, entity_type, entity_id, field_name, fact_type, normalized_claim, current_value, status, confirmation_method, owner_confirmed_at)
    values (actor, candidate.entity_type, candidate.entity_id, candidate.field_name,
      upper(candidate.entity_type::text || '_' || regexp_replace(candidate.field_name, '[^a-zA-Z0-9]+', '_', 'g')),
      final_claim, final_value, 'CONFIRMED', 'OWNER_CONFIRMED', now()) returning * into fact;
    insert into public.career_fact_versions (owner_id, career_fact_id, version_number, new_value, new_status, changed_by, change_source, reason)
    values (actor, fact.id, 1, final_value, 'CONFIRMED', actor, 'OWNER_REVIEW', 'Owner confirmed candidate fact.');
    update public.career_candidate_facts set career_fact_id = fact.id where id = candidate.id;
  else
    update public.career_facts set normalized_claim = final_claim, current_value = final_value, status = 'CONFIRMED', confirmation_method = 'OWNER_CONFIRMED', owner_confirmed_at = now()
    where id = candidate.career_fact_id and owner_id = actor returning * into fact;
  end if;
  insert into public.career_fact_sources (owner_id, career_fact_id, candidate_fact_id, source_id, source_reference, confirmation_method)
  values (actor, fact.id, candidate.id, candidate.source_id, candidate.source_reference, 'OWNER_CONFIRMED')
  on conflict (owner_id, career_fact_id, source_id, confirmation_method) do update set candidate_fact_id = excluded.candidate_fact_id, source_reference = excluded.source_reference, last_changed_at = now();
  return jsonb_build_object('resolved', true, 'status', 'CONFIRMED', 'factId', fact.id, 'version', fact.version_number);
end;
$$;

create function public.add_owner_career_fact(fact_kind text, claim text, change_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  fact public.career_facts%rowtype;
  owner_source uuid;
  generated_field text := 'owner_fact_' || replace(gen_random_uuid()::text, '-', '');
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if fact_kind !~ '^[A-Z][A-Z0-9_]{1,79}$' then raise exception 'Invalid fact type'; end if;
  if claim is null or char_length(btrim(claim)) not between 2 and 2000 then raise exception 'Career fact must contain between 2 and 2000 characters'; end if;
  select id into owner_source from public.career_sources where owner_id = actor and intake_identity = 'OWNER_STATEMENT';
  if owner_source is null then raise exception 'Owner statement source is unavailable'; end if;
  insert into public.career_facts (owner_id, entity_type, entity_id, field_name, fact_type, normalized_claim, current_value, status, confirmation_method, owner_confirmed_at)
  values (actor, 'PROFILE', actor, generated_field, fact_kind, lower(regexp_replace(btrim(claim), '\s+', ' ', 'g')), jsonb_build_object('ownerConfirmedClaim', btrim(claim)), 'CONFIRMED', 'OWNER_CONFIRMED', now()) returning * into fact;
  insert into public.career_fact_versions (owner_id, career_fact_id, version_number, new_value, new_status, changed_by, change_source, reason)
  values (actor, fact.id, 1, fact.current_value, 'CONFIRMED', actor, 'OWNER_REVIEW', coalesce(nullif(btrim(change_reason), ''), 'Owner added an authoritative career fact.'));
  insert into public.career_fact_sources (owner_id, career_fact_id, source_id, source_reference, confirmation_method)
  values (actor, fact.id, owner_source, 'Owner-entered Career Profile fact', 'OWNER_CONFIRMED');
  return jsonb_build_object('created', true, 'factId', fact.id, 'version', 1);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['career_source_extractions','career_facts','career_candidate_facts','career_fact_sources','career_fact_versions','career_fact_dependencies'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select using ((select auth.uid()) = owner_id)', 'owners read own ' || table_name, table_name);
  end loop;
end;
$$;

grant execute on function public.resolve_career_candidate(uuid, text, text) to authenticated;
grant execute on function public.add_owner_career_fact(text, text, text) to authenticated;
revoke all on function public.resolve_career_candidate(uuid, text, text) from public, anon;
revoke all on function public.add_owner_career_fact(text, text, text) from public, anon;
revoke all on function public.capture_career_fact_version() from public, anon, authenticated;
revoke all on function public.mark_career_fact_dependencies_stale() from public, anon, authenticated;
revoke all on function public.sync_career_fact_from_record() from public, anon, authenticated;
revoke all on function public.validate_career_fact_target() from public, anon, authenticated;
revoke all on function public.prepare_career_fact_update() from public, anon, authenticated;
revoke all on function public.protect_owner_confirmed_career_record() from public, anon, authenticated;
