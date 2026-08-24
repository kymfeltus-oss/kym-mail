-- Finalize the provider-connection boundary now that production code no longer
-- stores Google OAuth or synchronization state on individual send-as identities.
drop table if exists public.mail_account_credentials;

drop index if exists public.mail_accounts_provider_identity_key;
alter table public.mail_accounts
  drop column if exists provider,
  drop column if exists provider_account_id,
  drop column if exists connection_state,
  drop column if exists granted_scopes,
  drop column if exists sync_history_id,
  drop column if exists last_synced_at,
  drop column if exists sync_error,
  drop column if exists watch_expires_at;

alter table public.mail_threads
  alter column mail_connection_id set not null,
  drop constraint if exists mail_threads_mail_account_id_provider_thread_id_key;
drop index if exists public.mail_threads_connection_provider_key;
alter table public.mail_threads
  add constraint mail_threads_connection_provider_key unique (mail_connection_id, provider_thread_id);

alter table public.mail_messages
  alter column mail_connection_id set not null,
  drop constraint if exists mail_messages_mail_account_id_provider_message_id_key;
alter table public.mail_messages
  add constraint mail_messages_connection_provider_key unique (mail_connection_id, provider_message_id);

