-- B2B-skalering: små delings-payloads (uten base64), mottaker-lesing av avsenders Storage-objekter,
-- og billigere størrelsessjekk (pg_column_size) for å unngå CPU-spiss ved octet_length(jsonb::text).

ALTER TABLE public.session_shares
ADD COLUMN IF NOT EXISTS shared_object_names text[] NOT NULL DEFAULT '{}';

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
  v_len := pg_column_size(p_payload);
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

CREATE OR REPLACE FUNCTION public.send_session_share(
  p_recipient_short_id text,
  p_session_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid := auth.uid();
  v_to uuid;
  v_short text;
  v_name text;
  v_id uuid;
  v_len int;
  v_shared_names text[];
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_recipient_short_id IS NULL OR p_recipient_short_id !~ '^[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid recipient id';
  END IF;

  v_len := pg_column_size(p_session_payload);
  IF v_len IS NULL OR v_len > 104857600 THEN
    RAISE EXCEPTION 'Payload too large';
  END IF;

  SELECT coalesce(array_agg(p), '{}'::text[])
  INTO v_shared_names
  FROM (
    SELECT DISTINCT trim(elem->>'storageFullPath') AS p
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_session_payload->'photos') = 'array'
        THEN p_session_payload->'photos'
        ELSE '[]'::jsonb END
    ) AS elem
    WHERE elem ? 'storageFullPath'
      AND length(trim(elem->>'storageFullPath')) > 0
    UNION
    SELECT DISTINCT trim(elem->>'storageThumbPath') AS p
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_session_payload->'photos') = 'array'
        THEN p_session_payload->'photos'
        ELSE '[]'::jsonb END
    ) AS elem
    WHERE elem ? 'storageThumbPath'
      AND length(trim(elem->>'storageThumbPath')) > 0
  ) paths
  WHERE p IS NOT NULL;

  SELECT id INTO v_to FROM public.profiles
  WHERE short_id = p_recipient_short_id LIMIT 1;
  IF v_to IS NULL THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;
  IF v_to = v_from THEN
    RAISE EXCEPTION 'Cannot share to self';
  END IF;
  SELECT short_id, coalesce(display_name, '') INTO v_short, v_name
  FROM public.profiles WHERE id = v_from LIMIT 1;
  IF v_short IS NULL THEN
    RAISE EXCEPTION 'Sender profile missing';
  END IF;

  INSERT INTO public.session_shares (
    from_user_id, to_user_id, from_short_id, from_display_name, session_payload, shared_object_names
  ) VALUES (
    v_from, v_to, v_short, nullif(trim(v_name), ''), p_session_payload, coalesce(v_shared_names, '{}')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DROP POLICY IF EXISTS "scanix_user_photos_select_shared_with_me" ON storage.objects;

CREATE POLICY "scanix_user_photos_select_shared_with_me"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'scanix-user-photos'
  AND EXISTS (
    SELECT 1
    FROM public.session_shares ss
    WHERE ss.to_user_id = auth.uid()
      AND ss.shared_object_names IS NOT NULL
      AND array_length(ss.shared_object_names, 1) IS NOT NULL
      AND name = ANY (ss.shared_object_names)
  )
);
