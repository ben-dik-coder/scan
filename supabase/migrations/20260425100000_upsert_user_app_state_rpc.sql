-- Store user_app_state-payloads (mange økter) kan overskride standard statement_timeout via PostgREST-upsert.
-- RPC med SECURITY DEFINER + SET LOCAL statement_timeout gir ett transaksjonsvindu som tåler store merges.

CREATE OR REPLACE FUNCTION public.upsert_user_app_state(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_len int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_len := octet_length(p_payload::text);
  IF v_len IS NULL OR v_len > 12000000 THEN
    RAISE EXCEPTION 'Payload too large';
  END IF;

  SET LOCAL statement_timeout = '3min';

  INSERT INTO public.user_app_state (user_id, payload, updated_at)
  VALUES (v_uid, p_payload, now())
  ON CONFLICT (user_id) DO UPDATE SET
    payload = EXCLUDED.payload,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_app_state(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_app_state(jsonb) TO authenticated;
