alter table public.resume_targets
  add column if not exists intelligence jsonb not null default '{}'::jsonb check (jsonb_typeof(intelligence) = 'object'),
  add column if not exists intelligence_status text not null default 'NOT_RUN' check (intelligence_status in ('NOT_RUN', 'COMPLETE', 'FAILED')),
  add column if not exists intelligence_failure text check (intelligence_failure is null or char_length(btrim(intelligence_failure)) between 3 and 500);
