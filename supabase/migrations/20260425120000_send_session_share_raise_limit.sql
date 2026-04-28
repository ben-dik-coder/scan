-- Øk grense for «Del oppdrag» til annen bruker (jsonb som tekst), i tråd med upsert_user_app_state (12 MB).

CREATE OR REPLACE FUNCTION public.send_session_share(
  p_recipient_short_id text,
  p_session_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_from uuid := auth.uid();
  v_to uuid;
  v_short text;
  v_name text;
  v_id uuid;
  v_len int;
begin
  if v_from is null then
    raise exception 'Not authenticated';
  end if;
  if p_recipient_short_id is null or p_recipient_short_id !~ '^[0-9]{5}$' then
    raise exception 'Invalid recipient id';
  end if;
  v_len := octet_length(p_session_payload::text);
  if v_len is null or v_len > 12000000 then
    raise exception 'Payload too large';
  end if;
  select id into v_to from public.profiles
  where short_id = p_recipient_short_id limit 1;
  if v_to is null then
    raise exception 'Recipient not found';
  end if;
  if v_to = v_from then
    raise exception 'Cannot share to self';
  end if;
  select short_id, coalesce(display_name, '') into v_short, v_name
  from public.profiles where id = v_from limit 1;
  if v_short is null then
    raise exception 'Sender profile missing';
  end if;
  insert into public.session_shares (
    from_user_id, to_user_id, from_short_id, from_display_name, session_payload
  ) values (
    v_from, v_to, v_short, nullif(trim(v_name), ''), p_session_payload
  )
  returning id into v_id;
  return v_id;
end;
$$;
