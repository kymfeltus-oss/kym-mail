create type public.project_type as enum (
  'JOB_SEARCH',
  'BUSINESS_OUTREACH',
  'PARTNERSHIP',
  'NETWORKING',
  'CUSTOM'
);

create type public.project_status as enum ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

create type public.project_activity_type as enum (
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'STATUS_CHANGED',
  'MESSAGE_SENT',
  'REPLY_RECEIVED'
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  type public.project_type not null,
  objective text not null check (char_length(btrim(objective)) between 2 and 1000),
  status public.project_status not null default 'ACTIVE',
  default_mail_account_id uuid references public.mail_accounts(id) on delete set null,
  parameter_schema_version smallint not null default 1 check (parameter_schema_version = 1),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_status_updated_idx
  on public.projects (owner_id, status, updated_at desc);
create index projects_default_mail_account_idx
  on public.projects (default_mail_account_id)
  where default_mail_account_id is not null;

alter table public.mail_threads
  add column project_id uuid references public.projects(id) on delete set null;
create index mail_threads_project_last_message_idx
  on public.mail_threads (project_id, last_message_at desc)
  where project_id is not null;

alter table public.mail_messages
  add column project_id uuid references public.projects(id) on delete set null;
create index mail_messages_project_sent_idx
  on public.mail_messages (project_id, sent_at desc)
  where project_id is not null;

create table public.project_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_type public.project_activity_type not null,
  source_message_id uuid references public.mail_messages(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index project_activity_project_occurred_idx
  on public.project_activity (project_id, occurred_at desc);
create index project_activity_owner_occurred_idx
  on public.project_activity (owner_id, occurred_at desc);
create unique index project_activity_message_event_key
  on public.project_activity (project_id, activity_type, source_message_id)
  where source_message_id is not null;

create function public.validate_project_default_mail_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.default_mail_account_id is not null and not exists (
    select 1
    from public.mail_accounts account
    where account.id = new.default_mail_account_id
      and account.owner_id = new.owner_id
  ) then
    raise exception 'Project default mail account must belong to the project owner';
  end if;
  return new;
end;
$$;

create trigger projects_validate_default_mail_account
before insert or update of owner_id, default_mail_account_id on public.projects
for each row execute function public.validate_project_default_mail_account();

create function public.validate_project_association()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects project
    where project.id = new.project_id
      and project.owner_id = new.owner_id
  ) then
    raise exception 'Project association must belong to the record owner';
  end if;
  return new;
end;
$$;

create trigger mail_threads_validate_project
before insert or update of owner_id, project_id on public.mail_threads
for each row execute function public.validate_project_association();

create trigger mail_messages_validate_project
before insert or update of owner_id, project_id on public.mail_messages
for each row execute function public.validate_project_association();

create function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_project_updated_at();

create function public.record_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_activity (owner_id, project_id, activity_type)
    values (new.owner_id, new.id, 'PROJECT_CREATED');
  elsif old.status is distinct from new.status then
    insert into public.project_activity (owner_id, project_id, activity_type, details)
    values (
      new.owner_id,
      new.id,
      'STATUS_CHANGED',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  else
    insert into public.project_activity (owner_id, project_id, activity_type)
    values (new.owner_id, new.id, 'PROJECT_UPDATED');
  end if;
  return new;
end;
$$;

create trigger projects_record_change
after insert or update on public.projects
for each row execute function public.record_project_change();

create function public.record_project_mail_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type public.project_activity_type;
begin
  if new.project_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.project_id is not distinct from new.project_id then
    return new;
  end if;
  if new.is_sent then
    event_type := 'MESSAGE_SENT';
  elsif new.is_inbox then
    event_type := 'REPLY_RECEIVED';
  else
    return new;
  end if;
  insert into public.project_activity (
    owner_id,
    project_id,
    activity_type,
    source_message_id,
    details,
    occurred_at
  ) values (
    new.owner_id,
    new.project_id,
    event_type,
    new.id,
    jsonb_build_object('subject', new.subject),
    new.sent_at
  ) on conflict do nothing;
  return new;
end;
$$;

create trigger mail_messages_record_project_activity
after insert or update of project_id on public.mail_messages
for each row execute function public.record_project_mail_activity();

alter table public.projects enable row level security;
alter table public.project_activity enable row level security;

create policy "owners read own projects"
  on public.projects for select
  using ((select auth.uid()) = owner_id);
create policy "owners insert own projects"
  on public.projects for insert
  with check ((select auth.uid()) = owner_id);
create policy "owners update own projects"
  on public.projects for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete own projects"
  on public.projects for delete
  using ((select auth.uid()) = owner_id);
create policy "owners read own project activity"
  on public.project_activity for select
  using ((select auth.uid()) = owner_id);
