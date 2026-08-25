insert into public.career_candidate_facts (
  owner_id, extraction_id, source_id, career_fact_id, group_key, entity_type, entity_id,
  field_name, normalized_claim, extracted_value, source_reference, extraction_method,
  classification, status, confirmation_method, is_material, extracted_at, resolved_at
)
select profile.owner_id, extraction.id, source.id, fact.id, 'PROFILE:years_experience_claim',
  'PROFILE', profile.owner_id, 'years_experience_claim', lower(profile.years_experience_claim),
  to_jsonb(profile.years_experience_claim), 'RESUME_A · reviewed authoritative profile extraction',
  'PERSISTED_REVIEWED_IMPORT', 'POTENTIAL_CONFLICT', 'CONFIRMED', 'OWNER_CONFIRMED', true,
  profile.updated_at, profile.updated_at
from public.career_profiles profile
join public.career_facts fact on fact.owner_id = profile.owner_id and fact.entity_type = 'PROFILE'
  and fact.entity_id = profile.owner_id and fact.field_name = 'years_experience_claim'
join public.career_sources source on source.owner_id = profile.owner_id and source.intake_identity = 'RESUME_A'
join public.career_source_extractions extraction on extraction.owner_id = profile.owner_id and extraction.source_id = source.id
where profile.years_experience_claim is not null and profile.years_experience_claim <> '20+'
on conflict (extraction_id, entity_type, entity_id, field_name, normalized_claim) do update set
  classification = 'POTENTIAL_CONFLICT', status = 'CONFIRMED', confirmation_method = 'OWNER_CONFIRMED',
  review_reason = null, resolved_at = excluded.resolved_at, updated_at = now();

insert into public.career_fact_sources (owner_id, career_fact_id, candidate_fact_id, source_id, source_reference, confirmation_method)
select candidate.owner_id, candidate.career_fact_id, candidate.id, candidate.source_id,
  candidate.source_reference, 'OWNER_CONFIRMED'
from public.career_candidate_facts candidate
where candidate.group_key = 'PROFILE:years_experience_claim'
  and candidate.status = 'CONFIRMED' and candidate.confirmation_method = 'OWNER_CONFIRMED'
on conflict (owner_id, career_fact_id, source_id, confirmation_method) do update set
  candidate_fact_id = excluded.candidate_fact_id, source_reference = excluded.source_reference, last_changed_at = now();

update public.career_source_extractions extraction set candidate_count = counts.total, updated_at = now()
from (select extraction_id, count(*)::integer as total from public.career_candidate_facts group by extraction_id) counts
where extraction.id = counts.extraction_id;
