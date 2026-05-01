drop extension if exists "pg_net";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_trail(p_trail jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid := (p_trail->>'id')::uuid;
  v_user_id uuid := (p_trail->>'user_id')::uuid;
  v_applied boolean := false;
  v_final_updated_at timestamptz;
BEGIN
  IF v_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'upsert_trail: id and user_id are required';
  END IF;

  INSERT INTO public.trails (
    id, user_id, device_id, label, label_source, label_updated_at,
    created_at, updated_at, saved_at, node_count,
    root_url, root_title, root_favicon, payload, deleted_at
  )
  VALUES (
    v_id,
    v_user_id,
    (p_trail->>'device_id')::uuid,
    p_trail->>'label',
    (p_trail->>'label_source')::trail_label_source,
    (p_trail->>'label_updated_at')::timestamptz,
    COALESCE((p_trail->>'created_at')::timestamptz, now()),
    (p_trail->>'updated_at')::timestamptz,
    (p_trail->>'saved_at')::timestamptz,
    (p_trail->>'node_count')::int,
    p_trail->>'root_url',
    p_trail->>'root_title',
    p_trail->>'root_favicon',
    (p_trail->'payload'),
    NULLIF(p_trail->>'deleted_at', '')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE
    SET
      device_id = EXCLUDED.device_id,
      label = EXCLUDED.label,
      label_source = EXCLUDED.label_source,
      label_updated_at = EXCLUDED.label_updated_at,
      updated_at = EXCLUDED.updated_at,
      saved_at = EXCLUDED.saved_at,
      node_count = EXCLUDED.node_count,
      root_url = EXCLUDED.root_url,
      root_title = EXCLUDED.root_title,
      root_favicon = EXCLUDED.root_favicon,
      payload = EXCLUDED.payload,
      deleted_at = EXCLUDED.deleted_at
    WHERE trails.user_id = EXCLUDED.user_id
      AND trails.updated_at < EXCLUDED.updated_at
      AND (trails.deleted_at IS NULL OR EXCLUDED.updated_at > trails.deleted_at)
  RETURNING true INTO v_applied;

  v_applied := COALESCE(v_applied, false);

  SELECT updated_at INTO v_final_updated_at FROM public.trails WHERE id = v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'applied', v_applied,
    'updated_at', v_final_updated_at
  );
END;
$function$
;


