create type public.scheduled_mail_status as enum (
  'SCHEDULED',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED'
);

create type public.scheduled_mail_event_type as enum (
  'EMAIL_SCHEDULED',
  'SCHEDULE_EDITED',
  'EMAIL_RESCHEDULED',
  'SCHEDULE_CANCELLED',
  'SCHEDULED_EMAIL_SENT',
  'SCHEDULED_DELIVERY_FAILED',
  'SCHEDULE_RETRY_QUEUED'
);

create table public.scheduled_messages (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mail_account_id uuid not null references public.mail_accounts(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  provider_thread_id text,
  reply_to_message_id text,
  rfc_message_id text not null unique,
  to_addresses text[] not null,
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null,
  text_body text not null,
  scheduled_for timestamptz not null,
  timezone text not null,
  status public.scheduled_mail_status not null default 'SCHEDULED',
  version integer not null default 1 check (version > 0),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 5),
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  processing_token uuid,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  provider_message_id text,
  provider_thread_result_id text,
  provider_history_id text,
  sent_message_id uuid references public.mail_messages(id) on delete set null,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(to_addresses) between 1 and 100),
  check (char_length(subject) between 1 and 200),
  check (char_length(text_body) between 1 and 500000),
  check (char_length(timezone) between 1 and 100),
  check (provider_thread_id is null or char_length(provider_thread_id) <= 200),
  check (reply_to_message_id is null or char_length(reply_to_message_id) <= 998),
  check (char_length(rfc_message_id) between 10 and 998),
  check (status <> 'PROCESSING' or (claimed_at is not null and processing_token is not null)),
  check (status <> 'SENT' or (provider_message_id is not null and provider_thread_result_id is not null and sent_at is not null)),
  check (status <> 'CANCELLED' or cancelled_at is not null)
);

create index scheduled_messages_owner_status_time_idx
  on public.scheduled_messages (owner_id, status, scheduled_for);
create index scheduled_messages_due_idx
  on public.scheduled_messages (next_attempt_at, scheduled_for)
  where status = 'SCHEDULED';
create index scheduled_messages_project_idx
  on public.scheduled_messages (project_id, created_at desc)
  where project_id is not null;

create table public.scheduled_message_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_message_id uuid not null references public.scheduled_messages(id) on delete cascade,
  object_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (char_length(sha256) = 64),
  created_at timestamptz not null default now()
);

create index scheduled_message_attachments_message_idx
  on public.scheduled_message_attachments (scheduled_message_id, created_at);

create table public.scheduled_message_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_message_id uuid not null references public.scheduled_messages(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  event_type public.scheduled_mail_event_type not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index scheduled_message_events_message_idx
  on public.scheduled_message_events (scheduled_message_id, occurred_at desc);
create index scheduled_message_events_project_idx
  on public.scheduled_message_events (project_id, occurred_at desc)
  where project_id is not null;

create function public.validate_scheduled_message_relationships()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mail_accounts account
    where account.id = new.mail_account_id and account.owner_id = new.owner_id
  ) then
    raise exception 'Scheduled sender identity must belong to the owner';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects project
    where project.id = new.project_id and project.owner_id = new.owner_id
  ) then
    raise exception 'Scheduled Project must belong to the owner';
  end if;
  return new;
end;
$$;

create trigger scheduled_messages_validate_relationships
before insert or update of owner_id, mail_account_id, project_id on public.scheduled_messages
for each row execute function public.validate_scheduled_message_relationships();

create function public.validate_scheduled_attachment_relationships()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.scheduled_messages message
    where message.id = new.scheduled_message_id and message.owner_id = new.owner_id
  ) then
    raise exception 'Scheduled attachment must belong to the message owner';
  end if;
  return new;
end;
$$;

create trigger scheduled_attachments_validate_relationships
before insert or update of owner_id, scheduled_message_id on public.scheduled_message_attachments
for each row execute function public.validate_scheduled_attachment_relationships();

create function public.record_scheduled_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type public.scheduled_mail_event_type;
  event_details jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    event_type := 'EMAIL_SCHEDULED';
    event_details := jsonb_build_object('scheduledFor', new.scheduled_for, 'timezone', new.timezone);
  elsif old.status = 'SCHEDULED' and new.status = 'CANCELLED' then
    event_type := 'SCHEDULE_CANCELLED';
  elsif old.status is distinct from new.status and new.status = 'SENT' then
    event_type := 'SCHEDULED_EMAIL_SENT';
  elsif old.status is distinct from new.status and new.status = 'FAILED' then
    event_type := 'SCHEDULED_DELIVERY_FAILED';
    event_details := jsonb_build_object('code', coalesce(new.last_error_code, 'DELIVERY_FAILED'));
  elsif old.status = 'FAILED' and new.status = 'SCHEDULED' then
    event_type := 'SCHEDULE_RETRY_QUEUED';
  elsif old.status = 'SCHEDULED' and new.status = 'SCHEDULED' and old.scheduled_for is distinct from new.scheduled_for then
    event_type := 'EMAIL_RESCHEDULED';
    event_details := jsonb_build_object('from', old.scheduled_for, 'to', new.scheduled_for, 'timezone', new.timezone);
  elsif old.status = 'SCHEDULED' and new.status = 'SCHEDULED' and (
    old.mail_account_id is distinct from new.mail_account_id or
    old.project_id is distinct from new.project_id or
    old.to_addresses is distinct from new.to_addresses or
    old.cc_addresses is distinct from new.cc_addresses or
    old.bcc_addresses is distinct from new.bcc_addresses or
    old.subject is distinct from new.subject or
    old.text_body is distinct from new.text_body
  ) then
    event_type := 'SCHEDULE_EDITED';
  else
    return new;
  end if;

  insert into public.scheduled_message_events (
    owner_id, scheduled_message_id, project_id, event_type, details
  ) values (
    new.owner_id, new.id, new.project_id, event_type, event_details
  );
  return new;
end;
$$;

create trigger scheduled_messages_record_event
after insert or update on public.scheduled_messages
for each row execute function public.record_scheduled_message_event();

create function public.claim_due_scheduled_messages(claim_limit integer default 10)
returns setof public.scheduled_messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.scheduled_messages message
  set
    status = 'PROCESSING',
    processing_token = gen_random_uuid(),
    claimed_at = now(),
    last_attempt_at = now(),
    attempt_count = message.attempt_count + 1,
    updated_at = now()
  where message.id in (
    select candidate.id
    from public.scheduled_messages candidate
    where candidate.status = 'SCHEDULED'
      and candidate.scheduled_for <= now()
      and candidate.next_attempt_at <= now()
    order by candidate.scheduled_for
    for update skip locked
    limit greatest(1, least(claim_limit, 25))
  )
  returning message.*;
end;
$$;

create function public.recover_stale_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovered integer := 0;
  failed integer := 0;
begin
  update public.scheduled_messages
  set
    status = 'SCHEDULED',
    processing_token = null,
    claimed_at = null,
    next_attempt_at = now(),
    last_error_code = 'STALE_CLAIM_RECOVERED',
    last_error_message = 'A prior delivery attempt ended before completion. Delivery will be retried safely.',
    updated_at = now()
  where status = 'PROCESSING'
    and claimed_at < now() - interval '10 minutes'
    and attempt_count < max_attempts;
  get diagnostics recovered = row_count;

  update public.scheduled_messages
  set
    status = 'FAILED',
    processing_token = null,
    claimed_at = null,
    last_error_code = 'MAX_ATTEMPTS_REACHED',
    last_error_message = 'Delivery could not be completed after the allowed attempts.',
    updated_at = now()
  where status = 'PROCESSING'
    and claimed_at < now() - interval '10 minutes'
    and attempt_count >= max_attempts;
  get diagnostics failed = row_count;
  return recovered + failed;
end;
$$;

revoke all on function public.claim_due_scheduled_messages(integer) from public, anon, authenticated;
revoke all on function public.recover_stale_scheduled_messages() from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_messages(integer) to service_role;
grant execute on function public.recover_stale_scheduled_messages() to service_role;

alter table public.scheduled_messages enable row level security;
alter table public.scheduled_message_attachments enable row level security;
alter table public.scheduled_message_events enable row level security;

create policy "owners read own scheduled messages"
  on public.scheduled_messages for select
  using ((select auth.uid()) = owner_id);
create policy "owners read own scheduled attachments"
  on public.scheduled_message_attachments for select
  using ((select auth.uid()) = owner_id);
create policy "owners read own scheduled events"
  on public.scheduled_message_events for select
  using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('scheduled-mail-attachments', 'scheduled-mail-attachments', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;
