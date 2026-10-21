alter table public.scheduled_messages
  drop constraint if exists scheduled_messages_email_look_check;

alter table public.scheduled_messages
  add constraint scheduled_messages_email_look_check
  check (email_look is null or email_look in ('personal', 'snaptax', 'securafin', 'parable', 'parable-motion', 'mass'));
