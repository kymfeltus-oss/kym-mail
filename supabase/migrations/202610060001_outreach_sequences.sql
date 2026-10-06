create type public.outreach_lead_status as enum (
  'sent',
  'opened',
  'replied',
  'bounced',
  'do_not_contact',
  'passive'
);

create type public.outreach_sequence_status as enum (
  'active',
  'completed',
  'stopped'
);

create table public.outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mail_thread_id uuid not null references public.mail_threads(id) on delete cascade,
  mail_account_id uuid not null references public.mail_accounts(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  recipient_email text not null,
  recipient_name text not null default '',
  company_name text not null default '',
  timezone text not null,
  initial_sent_at timestamptz not null,
  lead_status public.outreach_lead_status not null default 'sent',
  sequence_stage smallint not null default 1 check (sequence_stage between 1 and 3),
  next_action_at timestamptz,
  status public.outreach_sequence_status not null default 'active',
  stopped_reason text,
  alerted_at timestamptz,
  follow_up_one_body text not null,
  follow_up_two_body text not null,
  provider_thread_id text not null,
  reply_to_message_id text not null,
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(recipient_email) between 3 and 254),
  check (char_length(recipient_name) <= 120),
  check (char_length(company_name) <= 160),
  check (char_length(timezone) between 1 and 100),
  check (char_length(follow_up_one_body) between 1 and 5000),
  check (char_length(follow_up_two_body) between 1 and 5000),
  check (char_length(subject) between 1 and 200),
  check (char_length(provider_thread_id) between 1 and 200),
  check (char_length(reply_to_message_id) between 1 and 998)
);

create unique index outreach_sequences_one_active_thread_idx
  on public.outreach_sequences (mail_thread_id)
  where status = 'active';

create index outreach_sequences_owner_status_idx
  on public.outreach_sequences (owner_id, status, next_action_at);

alter table public.scheduled_messages
  add column outreach_sequence_id uuid references public.outreach_sequences(id) on delete set null,
  add column outreach_touch smallint,
  add constraint scheduled_messages_outreach_touch_check
    check (outreach_touch is null or outreach_touch in (2, 3));

create index scheduled_messages_outreach_idx
  on public.scheduled_messages (outreach_sequence_id)
  where outreach_sequence_id is not null;

alter table public.outreach_sequences enable row level security;

create policy "owners read own outreach sequences"
  on public.outreach_sequences for select
  using ((select auth.uid()) = owner_id);
