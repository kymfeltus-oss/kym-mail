create type public.mail_connection_state as enum ('disconnected', 'connecting', 'connected', 'reauth_required', 'error');

alter table public.mail_accounts
  add column provider text,
  add column provider_account_id text,
  add column connection_state public.mail_connection_state not null default 'disconnected',
  add column granted_scopes text[] not null default '{}',
  add column sync_history_id text,
  add column last_synced_at timestamptz,
  add column sync_error text,
  add column watch_expires_at timestamptz;

create unique index mail_accounts_provider_identity_key
  on public.mail_accounts (provider, provider_account_id, lower(email_address))
  where provider_account_id is not null;

create table public.mail_account_credentials (
  mail_account_id uuid primary key references public.mail_accounts(id) on delete cascade,
  encrypted_access_token text,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mail_account_credentials enable row level security;
-- Credentials are server-only. No client RLS policy is intentionally defined.

create table public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  provider_thread_id text not null,
  subject text not null default '(no subject)',
  snippet text,
  last_message_at timestamptz not null,
  is_unread boolean not null default false,
  has_attachments boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mail_account_id, provider_thread_id)
);
create index mail_threads_owner_last_message_idx on public.mail_threads (owner_id, last_message_at desc);

create table public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  provider_message_id text not null,
  provider_history_id text,
  internet_message_id text,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null default '(no subject)',
  text_body text,
  sanitized_html_body text,
  sent_at timestamptz not null,
  is_inbox boolean not null default false,
  is_sent boolean not null default false,
  is_draft boolean not null default false,
  is_unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mail_account_id, provider_message_id)
);
create index mail_messages_thread_sent_idx on public.mail_messages (thread_id, sent_at);
create index mail_messages_owner_sent_idx on public.mail_messages (owner_id, sent_at desc);

create table public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.mail_messages(id) on delete cascade,
  provider_attachment_id text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (message_id, provider_attachment_id)
);

create table public.gmail_notifications (
  id uuid primary key default gen_random_uuid(),
  deduplication_key text not null unique,
  provider_email text not null,
  history_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_attachments enable row level security;
alter table public.gmail_notifications enable row level security;

create policy "owners manage own threads" on public.mail_threads for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own messages" on public.mail_messages for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own attachments" on public.mail_attachments for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
-- Notifications are server-only. No client RLS policy is intentionally defined.
