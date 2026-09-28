alter table public.client_session_bookings
  alter column client_id drop not null;

alter table public.client_session_bookings
  add column guest_name text,
  add column guest_email text;

alter table public.client_session_bookings
  add constraint client_session_bookings_guest_or_client check (
    (client_id is not null and guest_name is null and guest_email is null)
    or (
      client_id is null
      and guest_name is not null
      and char_length(btrim(guest_name)) between 2 and 120
      and guest_email is not null
      and guest_email = lower(guest_email)
      and char_length(guest_email) between 6 and 254
    )
  );

create index client_session_bookings_guest_email_idx
  on public.client_session_bookings (guest_email, created_at desc)
  where guest_email is not null;
