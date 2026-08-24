-- Gate 1 identity foundation: one owner may operate multiple mail addresses.
-- Provider connection, synchronization, messages, threads, and sending remain deferred.
create table public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email_address text not null check (
    email_address = lower(email_address)
    and email_address ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  label text not null check (char_length(label) between 1 and 80),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mail_accounts_owner_email_key
  on public.mail_accounts (owner_id, lower(email_address));
create unique index mail_accounts_one_default_per_owner_key
  on public.mail_accounts (owner_id) where is_default;

alter table public.mail_accounts enable row level security;
create policy "owners read own mail accounts"
  on public.mail_accounts for select
  using ((select auth.uid()) = owner_id);
create policy "owners insert own mail accounts"
  on public.mail_accounts for insert
  with check ((select auth.uid()) = owner_id);
create policy "owners update own mail accounts"
  on public.mail_accounts for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete own mail accounts"
  on public.mail_accounts for delete
  using ((select auth.uid()) = owner_id);
