create type public.consultation_payment_status as enum (
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_APPROVED',
  'PAYMENT_REJECTED',
  'BOOKING_RELEASED',
  'BOOKED',
  'CANCELLED'
);

create table public.consultation_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  consultation_name text not null check (char_length(btrim(consultation_name)) between 3 and 100),
  duration_minutes integer not null check (duration_minutes between 10 and 480),
  price_cents integer not null check (price_cents between 100 and 10000000),
  cash_app_handle text not null check (cash_app_handle ~ '^\$[A-Za-z0-9_]{1,20}$'),
  payment_instructions text not null check (char_length(btrim(payment_instructions)) between 10 and 1000),
  reference_instructions text check (reference_instructions is null or char_length(btrim(reference_instructions)) between 3 and 500),
  paid_booking_url text not null check (paid_booking_url ~ '^https://([A-Za-z0-9-]+\.)?cal\.com/'),
  free_booking_url text not null check (free_booking_url ~ '^https://([A-Za-z0-9-]+\.)?cal\.com/'),
  scheduling_provider text not null default 'CAL_COM' check (scheduling_provider = 'CAL_COM'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_name text not null check (char_length(btrim(client_name)) between 2 and 120),
  client_email text not null check (client_email = lower(client_email) and char_length(client_email) between 5 and 254),
  client_phone text check (client_phone is null or char_length(btrim(client_phone)) between 7 and 30),
  consultation_type text not null check (char_length(btrim(consultation_type)) between 3 and 100),
  expected_amount_cents integer not null check (expected_amount_cents between 100 and 10000000),
  client_note text check (client_note is null or char_length(btrim(client_note)) between 1 and 1000),
  proof_object_path text not null unique check (proof_object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,120}$'),
  proof_filename text not null check (char_length(proof_filename) between 1 and 120),
  proof_mime_type text not null check (proof_mime_type in ('image/png', 'image/jpeg', 'application/pdf')),
  proof_size_bytes integer not null check (proof_size_bytes between 1 and 8388608),
  proof_sha256 text not null check (proof_sha256 ~ '^[a-f0-9]{64}$'),
  payment_status public.consultation_payment_status not null default 'PAYMENT_SUBMITTED',
  status_token_hash text not null unique check (status_token_hash ~ '^[a-f0-9]{64}$'),
  booking_token_hash text unique check (booking_token_hash is null or booking_token_hash ~ '^[a-f0-9]{64}$'),
  booking_token_expires_at timestamptz,
  booking_released_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) between 3 and 500),
  provider_booking_id text unique check (provider_booking_id is null or char_length(provider_booking_id) between 2 and 200),
  provider_event_type_id text check (provider_event_type_id is null or char_length(provider_event_type_id) between 1 and 100),
  booking_start_at timestamptz,
  booking_end_at timestamptz,
  booking_timezone text check (booking_timezone is null or char_length(booking_timezone) between 2 and 100),
  booking_title text check (booking_title is null or char_length(booking_title) between 2 and 300),
  booked_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((payment_status = 'PAYMENT_REJECTED' and reviewed_at is not null and rejection_reason is not null) or payment_status <> 'PAYMENT_REJECTED'),
  check ((payment_status in ('BOOKING_RELEASED', 'BOOKED') and booking_token_hash is not null and booking_released_at is not null) or payment_status not in ('BOOKING_RELEASED', 'BOOKED')),
  check ((payment_status = 'BOOKED' and provider_booking_id is not null and booked_at is not null) or payment_status <> 'BOOKED')
);

create table public.consultation_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  consultation_request_id uuid not null references public.consultation_requests(id) on delete cascade,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  actor_type text not null check (actor_type in ('CLIENT', 'OWNER', 'PROVIDER', 'SYSTEM')),
  actor_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create table public.consultation_provider_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  consultation_request_id uuid references public.consultation_requests(id) on delete set null,
  provider text not null check (provider = 'CAL_COM'),
  event_fingerprint text not null unique check (event_fingerprint ~ '^[a-f0-9]{64}$'),
  provider_booking_id text,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text check (processing_error is null or char_length(processing_error) between 3 and 300)
);

create index consultation_requests_owner_status_idx on public.consultation_requests (owner_id, payment_status, created_at desc);
create index consultation_requests_owner_booking_idx on public.consultation_requests (owner_id, booking_start_at) where booking_start_at is not null;
create index consultation_events_request_idx on public.consultation_events (owner_id, consultation_request_id, created_at desc);
create index consultation_provider_events_request_idx on public.consultation_provider_events (owner_id, consultation_request_id, received_at desc);

create function public.touch_consultation_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger consultation_settings_touch_updated_at before update on public.consultation_settings
for each row execute function public.touch_consultation_updated_at();
create trigger consultation_requests_touch_updated_at before update on public.consultation_requests
for each row execute function public.touch_consultation_updated_at();

create function public.review_consultation_payment(
  target_owner uuid,
  target_request uuid,
  decision text,
  rejection_note text default null,
  released_token_hash text default null,
  released_token_expires_at timestamptz default null
)
returns public.consultation_payment_status
language plpgsql security definer set search_path = '' as $$
declare current_status public.consultation_payment_status;
begin
  select payment_status into current_status from public.consultation_requests
  where id = target_request and owner_id = target_owner for update;
  if current_status is null then raise exception 'Consultation request not found'; end if;
  if current_status <> 'PAYMENT_SUBMITTED' then raise exception 'Consultation request is not pending review'; end if;

  if decision = 'APPROVE' then
    if released_token_hash is null or released_token_expires_at is null then raise exception 'Booking release token is required'; end if;
    update public.consultation_requests set
      payment_status = 'BOOKING_RELEASED', reviewed_at = now(), reviewed_by = target_owner,
      rejection_reason = null, booking_token_hash = released_token_hash,
      booking_token_expires_at = released_token_expires_at, booking_released_at = now()
    where id = target_request and owner_id = target_owner;
    insert into public.consultation_events (owner_id, consultation_request_id, event_type, actor_type, actor_id)
    values
      (target_owner, target_request, 'PAYMENT_APPROVED', 'OWNER', target_owner),
      (target_owner, target_request, 'BOOKING_RELEASED', 'SYSTEM', target_owner);
    return 'BOOKING_RELEASED';
  elsif decision = 'REJECT' then
    if rejection_note is null or char_length(btrim(rejection_note)) < 3 then raise exception 'Rejection reason is required'; end if;
    update public.consultation_requests set
      payment_status = 'PAYMENT_REJECTED', reviewed_at = now(), reviewed_by = target_owner,
      rejection_reason = btrim(rejection_note), booking_token_hash = null,
      booking_token_expires_at = null, booking_released_at = null
    where id = target_request and owner_id = target_owner;
    insert into public.consultation_events (owner_id, consultation_request_id, event_type, actor_type, actor_id)
    values (target_owner, target_request, 'PAYMENT_REJECTED', 'OWNER', target_owner);
    return 'PAYMENT_REJECTED';
  end if;
  raise exception 'Unknown payment review decision';
end;
$$;

alter table public.consultation_settings enable row level security;
alter table public.consultation_requests enable row level security;
alter table public.consultation_events enable row level security;
alter table public.consultation_provider_events enable row level security;

revoke all on table public.consultation_settings, public.consultation_requests, public.consultation_events, public.consultation_provider_events from anon, authenticated;
grant select, insert, update on table public.consultation_settings to authenticated;
grant select on table public.consultation_requests, public.consultation_events, public.consultation_provider_events to authenticated;

create policy "owners manage own consultation settings" on public.consultation_settings
for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners read own consultation requests" on public.consultation_requests
for select using ((select auth.uid()) = owner_id);
create policy "owners read own consultation events" on public.consultation_events
for select using ((select auth.uid()) = owner_id);
create policy "owners read own consultation provider events" on public.consultation_provider_events
for select using ((select auth.uid()) = owner_id);

revoke all on function public.touch_consultation_updated_at() from public, anon, authenticated;
revoke all on function public.review_consultation_payment(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.review_consultation_payment(uuid, uuid, text, text, text, timestamptz) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultation-payment-proofs',
  'consultation-payment-proofs',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
