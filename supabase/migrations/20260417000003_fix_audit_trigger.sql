-- Fix: Make audit trigger tolerant of missing auth context (Java JDBC connections have no auth.uid())
CREATE OR REPLACE FUNCTION public.track_ledger_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed TEXT[] := '{}';
    col TEXT;
    old_json JSONB;
    new_json JSONB;
    current_user_id UUID;
BEGIN
    -- Safely get auth.uid(), returning NULL if not in a Supabase auth context
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        INSERT INTO public.security_audit (table_name, operation, record_id, old_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, old_json, current_user_id, now());
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);

        FOR col IN SELECT jsonb_object_keys(new_json)
        LOOP
            IF old_json ->> col IS DISTINCT FROM new_json ->> col THEN
                changed := array_append(changed, col);
            END IF;
        END LOOP;

        IF array_length(changed, 1) > 0 THEN
            INSERT INTO public.security_audit (table_name, operation, record_id, old_values, new_values, changed_fields, performed_by, performed_at)
            VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, old_json, new_json, changed, current_user_id, now());
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'INSERT' THEN
        new_json := to_jsonb(NEW);
        INSERT INTO public.security_audit (table_name, operation, record_id, new_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, new_json, current_user_id, now());
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
