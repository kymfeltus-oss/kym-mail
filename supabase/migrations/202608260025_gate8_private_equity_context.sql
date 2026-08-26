alter table public.job_contact_searches
  add column pe_sponsor_name text check (pe_sponsor_name is null or char_length(btrim(pe_sponsor_name)) between 2 and 120),
  add column pe_context_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(pe_context_evidence) = 'array');
