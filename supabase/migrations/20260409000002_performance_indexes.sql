-- Sprint 2 Evolutions

-- 1. FICO: The Intelligent General Ledger
CREATE TABLE public.general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    account_code VARCHAR(50) NOT NULL, -- e.g., 'COGS-001', 'REV-001'
    debit DECIMAL(15, 2) DEFAULT 0.00,
    credit DECIMAL(15, 2) DEFAULT 0.00,
    sku_id UUID REFERENCES public.sku_master(id),
    reference_transaction_id UUID, -- Maps back to stock_ledger
    description TEXT
);

-- 2. Prescriptive Intelligence: Keyword Themes (YAKE)
CREATE TABLE public.keyword_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID REFERENCES public.sku_master(id),
    theme_cluster VARCHAR(100) NOT NULL, -- e.g., "Build Quality"
    sentiment_score DECIMAL(5, 3),
    frequency INTEGER DEFAULT 1,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Prescriptive Intelligence: Competitor Matrix
CREATE TABLE public.competitor_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_sku_id UUID REFERENCES public.sku_master(id),
    competitor_url TEXT,
    competitor_price DECIMAL(10, 2),
    competitor_bsr INTEGER,
    market_capture_ratio DECIMAL(5, 3), -- Computed: our_rank / (our_rank + competitor_rank)
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. IoT Telemetry Table (Ensuring explicit table exists for Digital Twin to hook into)
CREATE TABLE IF NOT EXISTS public.iot_telemetry (
    id BIGSERIAL PRIMARY KEY,
    machine_id VARCHAR(100) NOT NULL,
    vibration_hz DECIMAL(10, 2),
    temp_celsius DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'NOMINAL',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DB Modification: Add Thermal Priority to SKU Master to track downscaled production
ALTER TABLE public.sku_master ADD COLUMN production_priority INTEGER DEFAULT 100;

-- 6. Performance Indexes: Scaling the Database past 1M Rows
CREATE INDEX idx_stock_ledger_sku_time ON public.stock_ledger(sku_id, created_at);
CREATE INDEX idx_iot_telemetry_machine_time ON public.iot_telemetry(machine_id, recorded_at);
CREATE INDEX idx_general_ledger_date ON public.general_ledger(transaction_date);

-- 7. Realtime Enablement for Dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.general_ledger;

-- 8. Add RLS for General Ledger (Executives only)
ALTER TABLE public.general_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Executives can view FICO" ON public.general_ledger FOR SELECT 
USING (public.user_role() IN ('SUPER_ADMIN'));
