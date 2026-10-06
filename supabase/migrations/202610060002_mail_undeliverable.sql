alter table public.mail_messages
  add column if not exists is_undeliverable boolean not null default false;

update public.mail_messages
set is_undeliverable = true
where is_undeliverable = false
  and (
    from_address ~* '^(mailer-daemon|postmaster|mail-daemon)@'
    or subject ~* '(undeliverable|delivery status notification|mail delivery failed|delivery failure|returned mail|undelivered mail|returning message to sender)'
  );

create index if not exists mail_messages_undeliverable_idx
  on public.mail_messages (owner_id, sent_at desc)
  where is_undeliverable;
