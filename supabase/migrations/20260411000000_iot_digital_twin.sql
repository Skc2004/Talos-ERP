-- =====================================================
-- Feature 2: IoT Digital Twin + Feature 1 NL Query Support
-- =====================================================

-- 1. IoT Telemetry Table (for Digital Twin)
CREATE TABLE IF NOT EXISTS public.iot_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id VARCHAR(100) NOT NULL,
    vibration_hz DECIMAL(8, 2),
    temp_celsius DECIMAL(8, 2),
    status VARCHAR(50) DEFAULT 'NOMINAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Maintenance Orders (triggered by anomalies)
CREATE TABLE IF NOT EXISTS public.maintenance_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id VARCHAR(100) NOT NULL,
    order_type VARCHAR(50) DEFAULT 'PREVENTIVE', -- PREVENTIVE, CORRECTIVE, EMERGENCY
    description TEXT,
    priority INTEGER DEFAULT 50,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, APPROVED, IN_PROGRESS, COMPLETED
    triggered_by VARCHAR(50) DEFAULT 'SYSTEM', -- SYSTEM, MANUAL
    estimated_downtime_hours DECIMAL(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. RLS
ALTER TABLE public.iot_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read telemetry" ON public.iot_telemetry FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Service can write telemetry" ON public.iot_telemetry FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can read maintenance" ON public.maintenance_orders FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Admins can manage maintenance" ON public.maintenance_orders FOR ALL
USING (public.user_role() IN ('SUPER_ADMIN', 'PLANNER'));

CREATE POLICY "Service can create maintenance" ON public.maintenance_orders FOR INSERT
WITH CHECK (true);

-- 4. Realtime for Digital Twin
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_orders;

-- 5. Auto-cleanup old telemetry (keep 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry()
RETURNS void AS $$
BEGIN
    DELETE FROM public.iot_telemetry WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Read-only SQL execution function for NL Query Engine
CREATE OR REPLACE FUNCTION public.exec_readonly_sql(query_text TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Safety: only allow SELECT
    IF NOT (UPPER(TRIM(query_text)) LIKE 'SELECT%') THEN
        RAISE EXCEPTION 'Only SELECT queries are permitted';
    END IF;
    
    -- Block dangerous keywords
    IF query_text ~* '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
        RAISE EXCEPTION 'Mutation queries are not permitted';
    END IF;
    
    EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t'
    INTO result;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '5s';

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON public.iot_telemetry(machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_machine ON public.maintenance_orders(machine_id, status);
