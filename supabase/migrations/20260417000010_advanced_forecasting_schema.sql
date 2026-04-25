-- Advanced Forecasting and Master Configuration Schema

-- 1. App Users (extending auth.users conceptually if needed, or standalone for the Python service)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 2. Inventory Snapshot (CSV ingested payload)
CREATE TABLE IF NOT EXISTS public.inventory_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Reorder Config (Threshold constraints per SKU/store concept)
CREATE TABLE IF NOT EXISTS public.reorder_config (
    sku TEXT PRIMARY KEY,
    avg_daily_usage NUMERIC NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 7,
    safety_stock NUMERIC NOT NULL,
    reorder_point NUMERIC NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 2000,
    target_level INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Alerts
CREATE TABLE IF NOT EXISTS public.alert (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL, -- e.g., 'STOCKOUT', 'BELOW_THRESHOLD'
    sku TEXT NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Enforcement
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert ENABLE ROW LEVEL SECURITY;

-- Allow Anon/Service Role Access for Python APIs
CREATE POLICY "Allow public access for dev Python app users" ON public.app_users FOR ALL USING (true);
CREATE POLICY "Allow public access for dev Python snapshots" ON public.inventory_snapshot FOR ALL USING (true);
CREATE POLICY "Allow public access for dev Python configs" ON public.reorder_config FOR ALL USING (true);
CREATE POLICY "Allow public access for dev Python alerts" ON public.alert FOR ALL USING (true);

-- Settings / App State Configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public settings access" ON public.system_settings FOR ALL USING (true);

-- Insert Default LLM Config
INSERT INTO public.system_settings (key, value) 
VALUES ('llm_provider', '{"active": "groq"}')
ON CONFLICT (key) DO NOTHING;
