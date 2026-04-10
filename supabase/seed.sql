-- Seed data to ensure NO HARDCODING in the app. The app pulls this dynamically.

-- Vendor definition
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'admin@mantra.com') ON CONFLICT DO NOTHING;

-- Seed SKU Master
INSERT INTO public.sku_master (id, sku_code, description, dimensions_cm, weight_kg, lead_time_days, reorder_point)
VALUES 
('11111111-1111-1111-1111-111111111111', 'B08L5WHFT9', 'Amazon Echo Dot (4th Gen) Black', '10x10x8.9', 0.34, 5, 20),
('22222222-2222-2222-2222-222222222222', 'B08C1W5N87', 'MacBook Air M1 Silver', '30x21x1.5', 1.29, 14, 5),
('33333333-3333-3333-3333-333333333333', 'RAW-PLASTIC-001', 'High Density Polyethylene Granules', 'N/A', 100.0, 7, 500)
ON CONFLICT (sku_code) DO NOTHING;

-- Seed historical stock ledger randomly so the AI has something to forecast
-- (Simulating past sales for B08L5WHFT9)
DO $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..60 LOOP
        INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, created_at)
        VALUES (
            '11111111-1111-1111-1111-111111111111', 
            'STOCK_ISSUE', 
            -1 * floor(random() * 5 + 1), -- Random issue of 1-5 units
            timezone('utc', now()) - (i || ' days')::interval
        );
    END LOOP;
END $$;
