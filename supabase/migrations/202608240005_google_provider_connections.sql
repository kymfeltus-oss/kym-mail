-- A Google authorization represents one provider mailbox. Multiple KYM Mail
-- identities (Gmail send-as addresses) may share that single connection.
create table public.mail_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_account_id text,
  connection_state public.mail_connection_state not null default 'disconnected',
  granted_scopes text[] not null default '{}',
  sync_history_id text,
  initial_sync_completed_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  watch_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_account_id is null or provider_account_id = lower(provider_account_id))
);

create unique index mail_connections_owner_provider_account_key
  on public.mail_connections (owner_id, provider, lower(provider_account_id))
  where provider_account_id is not null;

alter table public.mail_connections enable row level security;
create policy "owners read own mail connections"
  on public.mail_connections for select
  using ((select auth.uid()) = owner_id);
create policy "owners insert own mail connections"
  on public.mail_connections for insert
  with check ((select auth.uid()) = owner_id);
create policy "owners update own mail connections"
  on public.mail_connections for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete own mail connections"
  on public.mail_connections for delete
  using ((select auth.uid()) = owner_id);

create type public.mail_send_as_state as enum ('unavailable', 'unverified', 'available');

alter table public.mail_accounts
  add column mail_connection_id uuid references public.mail_connections(id) on delete set null,
  add column send_as_state public.mail_send_as_state not null default 'unavailable';

create index mail_accounts_connection_idx on public.mail_accounts (mail_connection_id);

create table public.mail_connection_credentials (
  mail_connection_id uuid primary key references public.mail_connections(id) on delete cascade,
  encrypted_access_token text,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mail_connection_credentials enable row level security;
-- Provider credentials are server-only. No client RLS policy is intentional.

alter table public.mail_threads
  add column mail_connection_id uuid references public.mail_connections(id) on delete cascade;
create unique index mail_threads_connection_provider_key
  on public.mail_threads (mail_connection_id, provider_thread_id)
  where mail_connection_id is not null;

alter table public.mail_messages
  add column mail_connection_id uuid references public.mail_connections(id) on delete cascade;
create index mail_messages_connection_sent_idx
  on public.mail_messages (mail_connection_id, sent_at desc);

alter table public.gmail_notifications
  add column mail_connection_id uuid references public.mail_connections(id) on delete cascade;
create index gmail_notifications_connection_received_idx
  on public.gmail_notifications (mail_connection_id, received_at desc);

