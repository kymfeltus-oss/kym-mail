-- Gate 7 correction: a partially matched requirement may carry a truthful,
-- structured gap reason (for example, CPA candidate versus active CPA license).
-- NO_MATCH and UNVERIFIED continue to require a gap reason. Fully matched and
-- non-applicable requirements continue to forbid one.

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.job_analysis_requirements'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%gap_reason%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.job_analysis_requirements drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table public.job_analysis_requirements
  add constraint job_analysis_requirements_gap_reason_check
  check (
    (match_state in ('NO_MATCH', 'UNVERIFIED') and gap_reason is not null)
    or match_state = 'PARTIAL_MATCH'
    or (
      match_state not in ('PARTIAL_MATCH', 'NO_MATCH', 'UNVERIFIED')
      and gap_reason is null
    )
  );
