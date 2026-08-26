create or replace function public.review_consultation_payment(
  target_owner uuid,
  target_request uuid,
  decision text,
  rejection_note text default null,
  released_token_hash text default null,
  released_token_expires_at timestamptz default null
)
returns public.consultation_payment_status
language plpgsql security definer set search_path = '' as $$
declare current_status public.consultation_payment_status;
begin
  select payment_status into current_status from public.consultation_requests
  where id = target_request and owner_id = target_owner for update;
  if current_status is null then raise exception 'Consultation request not found'; end if;
  if current_status <> 'PAYMENT_SUBMITTED' then raise exception 'Consultation request is not pending review'; end if;

  if decision = 'APPROVE' then
    if released_token_hash is null or released_token_expires_at is null then raise exception 'Booking release token is required'; end if;
    update public.consultation_requests set
      payment_status = 'BOOKING_RELEASED', reviewed_at = now(), reviewed_by = target_owner,
      rejection_reason = null, booking_token_hash = released_token_hash,
      booking_token_expires_at = released_token_expires_at, booking_released_at = now()
    where id = target_request and owner_id = target_owner;
    insert into public.consultation_events (owner_id, consultation_request_id, event_type, actor_type, actor_id)
    values
      (target_owner, target_request, 'PAYMENT_APPROVED', 'OWNER', target_owner),
      (target_owner, target_request, 'BOOKING_RELEASED', 'SYSTEM', target_owner);
    return 'BOOKING_RELEASED'::public.consultation_payment_status;
  elsif decision = 'REJECT' then
    if rejection_note is null or char_length(btrim(rejection_note)) < 3 then raise exception 'Rejection reason is required'; end if;
    update public.consultation_requests set
      payment_status = 'PAYMENT_REJECTED', reviewed_at = now(), reviewed_by = target_owner,
      rejection_reason = btrim(rejection_note), booking_token_hash = null,
      booking_token_expires_at = null, booking_released_at = null
    where id = target_request and owner_id = target_owner;
    insert into public.consultation_events (owner_id, consultation_request_id, event_type, actor_type, actor_id)
    values (target_owner, target_request, 'PAYMENT_REJECTED', 'OWNER', target_owner);
    return 'PAYMENT_REJECTED'::public.consultation_payment_status;
  end if;
  raise exception 'Unknown payment review decision';
end;
$$;

revoke all on function public.review_consultation_payment(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.review_consultation_payment(uuid, uuid, text, text, text, timestamptz) to service_role;
