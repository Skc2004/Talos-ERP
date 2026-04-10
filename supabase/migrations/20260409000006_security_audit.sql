-- Production Hardening: Security Audit & Governance Layer

-- 1. Immutable Audit Log Table
CREATE TABLE public.security_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,          -- INSERT, UPDATE, DELETE
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    performed_by UUID,                       -- auth.uid() at time of change
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ip_address INET,
    session_id TEXT
);

-- Use BIGINT identity for audit so it's never reusable / never gaps in sequence
-- This table is APPEND-ONLY: no UPDATE or DELETE policies

ALTER TABLE public.security_audit ENABLE ROW LEVEL SECURITY;

-- Only SUPER_ADMIN can read the audit trail
CREATE POLICY "Only admins can view audits" ON public.security_audit FOR SELECT
USING (public.user_role() = 'SUPER_ADMIN');

-- Nobody can modify audit records via the API
CREATE POLICY "Audit records are immutable" ON public.security_audit FOR UPDATE USING (false);
CREATE POLICY "Audit records cannot be deleted" ON public.security_audit FOR DELETE USING (false);

-- 2. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION public.track_ledger_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed TEXT[] := '{}';
    col TEXT;
    old_json JSONB;
    new_json JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        old_json := to_jsonb(OLD);
        INSERT INTO public.security_audit (table_name, operation, record_id, old_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, old_json, auth.uid(), now());
        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);

        -- Identify which fields actually changed
        FOR col IN SELECT jsonb_object_keys(new_json)
        LOOP
            IF old_json ->> col IS DISTINCT FROM new_json ->> col THEN
                changed := array_append(changed, col);
            END IF;
        END LOOP;

        -- Only log if something actually changed
        IF array_length(changed, 1) > 0 THEN
            INSERT INTO public.security_audit (table_name, operation, record_id, old_values, new_values, changed_fields, performed_by, performed_at)
            VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, old_json, new_json, changed, auth.uid(), now());
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'INSERT' THEN
        new_json := to_jsonb(NEW);
        INSERT INTO public.security_audit (table_name, operation, record_id, new_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, new_json, auth.uid(), now());
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Triggers to Financial Tables
CREATE TRIGGER audit_general_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.general_ledger
    FOR EACH ROW EXECUTE FUNCTION public.track_ledger_changes();

CREATE TRIGGER audit_stock_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.stock_ledger
    FOR EACH ROW EXECUTE FUNCTION public.track_ledger_changes();

CREATE TRIGGER audit_crm_leads
    AFTER INSERT OR UPDATE OR DELETE ON public.crm_leads
    FOR EACH ROW EXECUTE FUNCTION public.track_ledger_changes();

CREATE TRIGGER audit_projects
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.track_ledger_changes();

-- 4. Performance Indexes for Audit Queries
CREATE INDEX idx_audit_table_time ON public.security_audit(table_name, performed_at);
CREATE INDEX idx_audit_record ON public.security_audit(record_id);
CREATE INDEX idx_audit_operation ON public.security_audit(operation);

-- 5. Realtime for live audit monitor
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_audit;
