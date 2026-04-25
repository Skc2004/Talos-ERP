-- ============================================================
-- Warehouses table: Master location data for the warehouse map
-- ============================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 5000,
    warehouse_type VARCHAR(50) DEFAULT 'DISTRIBUTION_CENTER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with public read (per Supabase skill: RLS on all exposed schema tables)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read warehouses" ON public.warehouses FOR SELECT USING (true);

-- Seed 5 Indian warehouse locations
INSERT INTO public.warehouses (code, name, city, state, latitude, longitude, max_capacity, warehouse_type)
VALUES
    ('WAREHOUSE-A', 'Mumbai Central Hub', 'Mumbai', 'Maharashtra', 19.076090, 72.877426, 5000, 'CENTRAL_HUB'),
    ('WAREHOUSE-B', 'Delhi NCR Distribution', 'Delhi', 'Delhi NCR', 28.613939, 77.209023, 8000, 'DISTRIBUTION_CENTER'),
    ('WAREHOUSE-C', 'Bangalore Tech Park', 'Bangalore', 'Karnataka', 12.971599, 77.594566, 3500, 'FULFILLMENT_CENTER'),
    ('WAREHOUSE-D', 'Chennai Port Facility', 'Chennai', 'Tamil Nadu', 13.082680, 80.270718, 4000, 'PORT_FACILITY'),
    ('WAREHOUSE-E', 'Pune Manufacturing', 'Pune', 'Maharashtra', 18.520430, 73.856744, 2500, 'MANUFACTURING')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Distribute existing WAREHOUSE-A stock across all warehouses
-- so each one has realistic capacity utilization
-- ============================================================

-- Update some existing stock_ledger entries to other warehouses
UPDATE public.stock_ledger SET location = 'WAREHOUSE-B' WHERE id IN (
    SELECT id FROM public.stock_ledger WHERE location = 'WAREHOUSE-A' OR location IS NULL ORDER BY random() LIMIT 50
);
UPDATE public.stock_ledger SET location = 'WAREHOUSE-C' WHERE id IN (
    SELECT id FROM public.stock_ledger WHERE location = 'WAREHOUSE-A' ORDER BY random() LIMIT 40
);
UPDATE public.stock_ledger SET location = 'WAREHOUSE-D' WHERE id IN (
    SELECT id FROM public.stock_ledger WHERE location = 'WAREHOUSE-A' ORDER BY random() LIMIT 35
);
UPDATE public.stock_ledger SET location = 'WAREHOUSE-E' WHERE id IN (
    SELECT id FROM public.stock_ledger WHERE location = 'WAREHOUSE-A' ORDER BY random() LIMIT 25
);

-- Seed additional STOCK_RECEIPT entries so warehouses have positive stock
DO $$
DECLARE
    sku_ids UUID[] := ARRAY[
        '11111111-1111-1111-1111-111111111111'::UUID,
        '22222222-2222-2222-2222-222222222222'::UUID,
        '33333333-3333-3333-3333-333333333333'::UUID
    ];
    wh_codes TEXT[] := ARRAY['WAREHOUSE-A','WAREHOUSE-B','WAREHOUSE-C','WAREHOUSE-D','WAREHOUSE-E'];
    base_qty INT[] := ARRAY[800, 1200, 500, 650, 350];
    sid UUID;
    wh TEXT;
    i INT;
    j INT;
BEGIN
    FOR i IN 1..array_length(wh_codes, 1) LOOP
        wh := wh_codes[i];
        FOREACH sid IN ARRAY sku_ids LOOP
            -- Add a large receipt entry
            INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
            VALUES (
                sid,
                'STOCK_RECEIPT',
                base_qty[i] + floor(random() * 200)::int,
                wh,
                'INIT-' || wh || '-' || sid::text,
                timezone('utc', now()) - interval '30 days'
            );
            -- Add some recent issues to reduce stock to realistic levels
            FOR j IN 1..10 LOOP
                INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
                VALUES (
                    sid,
                    'STOCK_ISSUE',
                    -1 * floor(random() * 20 + 5)::int,
                    wh,
                    'DEMAND-' || wh || '-' || j,
                    timezone('utc', now()) - (j || ' days')::interval
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;
