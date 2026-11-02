-- NOTIFY is delivered only after COMMIT. Rollback discards the notification.
-- Identity-only envelopes: no translation text, user data, or document events.
CREATE FUNCTION public.notify_translation_table_live_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  row_data jsonb;
  record_id text;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD);
  ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'translations' THEN
    record_id := row_data ->> 'key_id';
    event_type := 'updated';
  ELSIF TG_TABLE_NAME = 'translation_keys' THEN
    record_id := row_data ->> 'id';
    event_type := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END;
  ELSE
    event_type := 'invalidate';
  END IF;
  PERFORM pg_notify('datatable_live_v1', jsonb_strip_nulls(jsonb_build_object(
    'version', 1, 'eventId', gen_random_uuid()::text, 'resource', 'translations',
    'type', event_type, 'recordId', record_id, 'occurredAt', clock_timestamp()
  ))::text);
  RETURN NULL;
END;
$$;

CREATE TRIGGER translation_keys_live_v1 AFTER INSERT OR UPDATE OR DELETE ON public.translation_keys
FOR EACH ROW EXECUTE FUNCTION public.notify_translation_table_live_v1();
CREATE TRIGGER translation_values_live_v1 AFTER INSERT OR UPDATE OR DELETE ON public.translations
FOR EACH ROW EXECUTE FUNCTION public.notify_translation_table_live_v1();
CREATE TRIGGER translation_categories_live_v1 AFTER INSERT OR UPDATE OR DELETE ON public.translation_category
FOR EACH ROW EXECUTE FUNCTION public.notify_translation_table_live_v1();
