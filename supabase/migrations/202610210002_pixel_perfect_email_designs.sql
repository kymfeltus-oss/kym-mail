alter table public.scheduled_messages
  add column is_pixel_perfect boolean not null default false,
  add column email_design_share_token_hash text,
  add column email_design_share_url text;

alter table public.scheduled_messages
  add constraint scheduled_messages_pixel_design_check
  check (
    (is_pixel_perfect and email_design_share_token_hash is not null and email_design_share_token_hash ~ '^[a-f0-9]{64}$' and email_design_share_url is not null)
    or (not is_pixel_perfect and email_design_share_token_hash is null and email_design_share_url is null)
  );

create table public.email_design_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  object_path text not null unique,
  subject text not null check (char_length(subject) between 1 and 200),
  from_address text not null check (char_length(from_address) between 3 and 254),
  text_body text not null check (char_length(text_body) between 1 and 501000),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index email_design_shares_owner_expiry_idx
  on public.email_design_shares (owner_id, expires_at);

alter table public.email_design_shares enable row level security;

create policy "owners read own email design shares"
  on public.email_design_shares for select
  using ((select auth.uid()) = owner_id);

create policy "owners delete own email design shares"
  on public.email_design_shares for delete
  using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-design-shares', 'email-design-shares', false, 8388608, array['image/png']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
