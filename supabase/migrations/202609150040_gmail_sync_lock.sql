alter table public.mail_connections
  add column if not exists sync_lock_at timestamptz;

comment on column public.mail_connections.sync_lock_at is 'Exclusive Gmail sync lease. Null when idle.';
