alter table public.consultation_settings
  drop constraint if exists consultation_settings_cash_app_handle_check;

alter table public.consultation_settings
  rename column cash_app_handle to zelle_contact;

alter table public.consultation_settings
  add column zelle_recipient_name text not null
    check (char_length(btrim(zelle_recipient_name)) between 2 and 120),
  add constraint consultation_settings_zelle_contact_check check (
    zelle_contact ~ '^\+?[0-9][0-9 ()-]{6,29}$'
    or zelle_contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on column public.consultation_settings.zelle_recipient_name is
  'Public recipient name clients use to confirm the intended Zelle recipient.';
comment on column public.consultation_settings.zelle_contact is
  'Public Zelle phone number or email; no bank or payment-provider credentials are stored.';
