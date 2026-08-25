create or replace function public.capture_career_fact_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_value jsonb := to_jsonb(old);
  new_value jsonb := to_jsonb(new);
  fields text[];
  actor uuid := auth.uid();
  target_type public.career_entity_type := tg_argv[0]::public.career_entity_type;
  target_id uuid;
begin
  select array_agg(key order by key)
  into fields
  from jsonb_object_keys(new_value) as key
  where key not in ('created_at', 'updated_at')
    and old_value -> key is distinct from new_value -> key;

  if coalesce(cardinality(fields), 0) = 0 then
    return new;
  end if;

  if actor is not null and actor <> new.owner_id then
    raise exception 'Career fact history actor must be the record owner';
  end if;

  target_id := case
    when target_type = 'PROFILE' then new.owner_id
    else (new_value ->> 'id')::uuid
  end;
  insert into public.career_fact_history (
    owner_id, entity_type, entity_id, changed_fields, old_record, new_record,
    change_source, changed_by
  ) values (
    new.owner_id, target_type, target_id, fields, old_value, new_value,
    case when actor = new.owner_id then 'OWNER_EDIT' else 'CONTROLLED_IMPORT' end,
    actor
  );
  return new;
end;
$$;

revoke all on function public.capture_career_fact_history() from public, anon, authenticated;
