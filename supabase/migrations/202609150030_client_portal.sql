alter table public.consultation_settings
  add column if not exists client_session_booking_url text
    check (client_session_booking_url is null or client_session_booking_url ~ '^https://([A-Za-z0-9-]+\.)?cal\.com/'),
  add column if not exists client_sessions_active boolean not null default false;

comment on column public.consultation_settings.client_session_booking_url is
  'Private Cal.com URL for the 15-minute existing-client session. Not a public free meeting.';
comment on column public.consultation_settings.client_sessions_active is
  'When true, registered paying clients may book a 15-minute session with their client number.';

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_number text not null check (client_number ~ '^KYM-[0-9]{6}$'),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (email = lower(email) and char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(btrim(phone)) between 7 and 30),
  is_active boolean not null default true,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_number),
  unique (owner_id, email)
);

create table public.client_credentials (
  client_id uuid primary key references public.clients(id) on delete cascade,
  password_hash text not null check (char_length(password_hash) between 40 and 500),
  password_set_at timestamptz not null default now()
);

create table public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  status text not null check (status in ('PENDING', 'RECEIVED', 'FAILED', 'REFUNDED')),
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  status text not null check (status in ('INTAKE', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'COMPLETED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_job_updates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.client_jobs(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.client_session_bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  duration_minutes integer not null default 15 check (duration_minutes = 15),
  status text not null check (status in ('RELEASED', 'BOOKED', 'CANCELLED')),
  provider_booking_id text unique check (provider_booking_id is null or char_length(provider_booking_id) between 2 and 200),
  booking_start_at timestamptz,
  booking_end_at timestamptz,
  booking_timezone text check (booking_timezone is null or char_length(booking_timezone) between 2 and 100),
  booking_title text check (booking_title is null or char_length(booking_title) between 2 and 300),
  booked_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'BOOKED' and provider_booking_id is not null and booked_at is not null) or status <> 'BOOKED'),
  check ((status = 'CANCELLED' and cancelled_at is not null) or status <> 'CANCELLED')
);

create index clients_owner_idx on public.clients (owner_id, created_at desc);
create index client_sessions_expiry_idx on public.client_sessions (client_id, expires_at);
create index client_payments_client_idx on public.client_payments (owner_id, client_id, occurred_at desc);
create index client_jobs_client_idx on public.client_jobs (owner_id, client_id, updated_at desc);
create index client_job_updates_job_idx on public.client_job_updates (job_id, created_at desc);
create index client_session_bookings_client_idx on public.client_session_bookings (owner_id, client_id, created_at desc);
create index client_session_bookings_open_idx on public.client_session_bookings (client_id, status) where status = 'RELEASED';

create function public.touch_client_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_touch_updated_at before update on public.clients
for each row execute function public.touch_client_updated_at();
create trigger client_payments_touch_updated_at before update on public.client_payments
for each row execute function public.touch_client_updated_at();
create trigger client_jobs_touch_updated_at before update on public.client_jobs
for each row execute function public.touch_client_updated_at();
create trigger client_session_bookings_touch_updated_at before update on public.client_session_bookings
for each row execute function public.touch_client_updated_at();

alter table public.clients enable row level security;
alter table public.client_credentials enable row level security;
alter table public.client_sessions enable row level security;
alter table public.client_payments enable row level security;
alter table public.client_jobs enable row level security;
alter table public.client_job_updates enable row level security;
alter table public.client_session_bookings enable row level security;

revoke all on table public.clients, public.client_credentials, public.client_sessions, public.client_payments, public.client_jobs, public.client_job_updates, public.client_session_bookings from public, anon, authenticated;
grant select, insert, update, delete on table public.clients, public.client_payments, public.client_jobs, public.client_job_updates, public.client_session_bookings to authenticated;

create policy "owners manage own clients" on public.clients
for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own client payments" on public.client_payments
for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own client jobs" on public.client_jobs
for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage own client job updates" on public.client_job_updates
for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners read own client session bookings" on public.client_session_bookings
for select using ((select auth.uid()) = owner_id);

revoke all on function public.touch_client_updated_at() from public, anon, authenticated;
