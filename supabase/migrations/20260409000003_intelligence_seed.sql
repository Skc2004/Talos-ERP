-- Sprint 3 Intelligence Seed Data
-- Populates ALL tables so the Dashboard, Logic Debugger, and Prescriptive Cards
-- have real data to display during the C-Suite demo.

-- 0. Master SKU Data (must exist before FK-dependent tables)
INSERT INTO public.sku_master (id, sku_code, description, dimensions_cm, weight_kg, lead_time_days, reorder_point, production_priority)
VALUES
('11111111-1111-1111-1111-111111111111', 'B08L5WHFT9', 'Amazon Echo Dot (4th Gen) Black', '10x10x8.9', 0.34, 5, 20, 100),
('22222222-2222-2222-2222-222222222222', 'B08C1W5N87', 'MacBook Air M1 Silver', '30x21x1.5', 1.29, 14, 5, 100),
('33333333-3333-3333-3333-333333333333', 'RAW-PLASTIC-001', 'High Density Polyethylene Granules', 'N/A', 100.0, 7, 500, 100)
ON CONFLICT (sku_code) DO NOTHING;

-- 0b. Historical stock ledger (60 days of random STOCK_ISSUE for demand calculations)
DO $$
DECLARE
    i INT;
    sku_ids UUID[] := ARRAY['11111111-1111-1111-1111-111111111111'::UUID, '22222222-2222-2222-2222-222222222222'::UUID];
    sid UUID;
BEGIN
    FOREACH sid IN ARRAY sku_ids LOOP
        FOR i IN 1..60 LOOP
            INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, created_at)
            VALUES (
                sid,
                'STOCK_ISSUE',
                -1 * floor(random() * 5 + 1)::int,
                timezone('utc', now()) - (i || ' days')::interval
            );
        END LOOP;
    END LOOP;
END $$;

-- 1. Competitor Market Capture data
INSERT INTO public.competitor_data (our_sku_id, competitor_url, competitor_price, competitor_bsr, market_capture_ratio)
VALUES
('11111111-1111-1111-1111-111111111111', 'https://amazon.in/dp/B09ZX1RNR4', 34.99, 3200, 0.319),
('11111111-1111-1111-1111-111111111111', 'https://amazon.in/dp/B0BHNR43VY', 29.99, 4800, 0.238),
('22222222-2222-2222-2222-222222222222', 'https://amazon.in/dp/B0D96JCHZR', 899.00, 800, 0.652),
('33333333-3333-3333-3333-333333333333', 'https://flipkart.com/raw-hdpe-001', 12.50, 6100, 0.197);

-- 2. YAKE Keyword Theme intelligence
INSERT INTO public.keyword_themes (sku_id, theme_cluster, sentiment_score, frequency)
VALUES
('11111111-1111-1111-1111-111111111111', 'Build Quality', 0.82, 47),
('11111111-1111-1111-1111-111111111111', 'Audio Crackle', -0.71, 23),
('11111111-1111-1111-1111-111111111111', 'Fast Shipping', 0.91, 68),
('22222222-2222-2222-2222-222222222222', 'Battery Life', 0.88, 52),
('22222222-2222-2222-2222-222222222222', 'Keyboard Flex', -0.55, 14),
('33333333-3333-3333-3333-333333333333', 'Durability', 0.73, 31),
('33333333-3333-3333-3333-333333333333', 'Packaging Damage', -0.64, 19);

-- 3. IoT Telemetry (prime the Moving Z-Score detector with a baseline)
INSERT INTO public.iot_telemetry (machine_id, vibration_hz, temp_celsius, status)
SELECT
    m.machine_id,
    round((45.0 + random() * 15)::numeric, 2),
    round((m.base_temp + (random() * 10 - 5))::numeric, 2),
    'NOMINAL'
FROM (
    VALUES ('EXTRUDER-01', 195.0), ('MOLDING-A3', 182.0), ('PACKAGING-LINE-2', 85.0)
) AS m(machine_id, base_temp),
generate_series(1, 20);

-- 4. Inject one thermal anomaly so the Digital Twin lights up red
INSERT INTO public.iot_telemetry (machine_id, vibration_hz, temp_celsius, status)
VALUES ('EXTRUDER-01', 58.7, 228.5, 'ANOMALY_DETECTED');

-- 5. General Ledger seed (FICO demo entries)
INSERT INTO public.general_ledger (account_code, debit, credit, sku_id, description)
VALUES
('COGS-1004', 1250.00, 0.00, '11111111-1111-1111-1111-111111111111', 'Finished Goods COGS - Echo Dot batch 50 units'),
('REV-2001', 0.00, 2499.50, '11111111-1111-1111-1111-111111111111', 'Revenue recognition - Echo Dot 50 units @ $49.99'),
('COGS-1004', 44950.00, 0.00, '22222222-2222-2222-2222-222222222222', 'Finished Goods COGS - MacBook Air batch 5 units'),
('REV-2001', 0.00, 64995.00, '22222222-2222-2222-2222-222222222222', 'Revenue recognition - MacBook Air 5 units @ $12,999');
