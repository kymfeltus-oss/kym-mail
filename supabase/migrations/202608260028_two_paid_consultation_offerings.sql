alter table public.consultation_settings
  alter column free_booking_url drop not null,
  add column returning_booking_url text
    check (returning_booking_url is null or returning_booking_url ~ '^https://([A-Za-z0-9-]+\.)?cal\.com/');

alter table public.consultation_requests
  add column consultation_kind text not null default 'FIRST_TIME'
    check (consultation_kind in ('FIRST_TIME', 'RETURNING'));

create index consultation_requests_first_time_history_idx
  on public.consultation_requests (owner_id, client_email, booking_end_at)
  where consultation_kind = 'FIRST_TIME' and payment_status = 'BOOKED';

comment on column public.consultation_settings.paid_booking_url is
  'Private Cal.com URL for the fixed 60-minute first-time consultation.';
comment on column public.consultation_settings.returning_booking_url is
  'Private Cal.com URL for the fixed 60-minute returning-client consultation.';
comment on column public.consultation_settings.free_booking_url is
  'Legacy field retained nullable; KYM Mail no longer offers free meetings.';
