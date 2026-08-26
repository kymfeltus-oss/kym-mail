-- Every owner-confirmed fact must retain an explicit owner-source link. The
-- normalized Gate 6 profile predates the Gate 6A fact ledger, so backfill only
-- facts that do not already have source provenance. No source extraction runs.
insert into public.career_fact_sources (
  owner_id, career_fact_id, source_id, source_reference, confirmation_method, first_added_at, last_changed_at
)
select fact.owner_id, fact.id, source.id,
  'Owner-confirmed Gate 6 authoritative profile resolution',
  'OWNER_CONFIRMED', fact.first_added_at, fact.last_changed_at
from public.career_facts fact
join public.career_sources source
  on source.owner_id = fact.owner_id and source.intake_identity = 'OWNER_STATEMENT'
where fact.confirmation_method = 'OWNER_CONFIRMED'
  and not exists (
    select 1 from public.career_fact_sources existing
    where existing.owner_id = fact.owner_id and existing.career_fact_id = fact.id
  )
on conflict (owner_id, career_fact_id, source_id, confirmation_method) do nothing;
