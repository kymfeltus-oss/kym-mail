alter table public.scheduled_message_attachments
  drop constraint if exists scheduled_message_attachments_size_bytes_check;

alter table public.scheduled_message_attachments
  add constraint scheduled_message_attachments_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 20971520);

update storage.buckets
set file_size_limit = 20971520
where id = 'scheduled-mail-attachments';

insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-compose-uploads', 'mail-compose-uploads', false, 20971520)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;
