-- Add stock receipts to warehouses that ended up with 0 or low stock
DO $$
DECLARE
    sku_ids UUID[] := ARRAY[
        '11111111-1111-1111-1111-111111111111'::UUID,
        '22222222-2222-2222-2222-222222222222'::UUID,
        '33333333-3333-3333-3333-333333333333'::UUID
    ];
    sid UUID;
BEGIN
    -- Delhi: large distribution center, should be 60-75% utilized
    FOREACH sid IN ARRAY sku_ids LOOP
        INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
        VALUES (sid, 'STOCK_RECEIPT', 1500 + floor(random()*500)::int, 'WAREHOUSE-B', 'BOOST-B-' || sid::text, timezone('utc', now()) - interval '15 days');
    END LOOP;

    -- Bangalore: fulfillment, should be 40-55%
    FOREACH sid IN ARRAY sku_ids LOOP
        INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
        VALUES (sid, 'STOCK_RECEIPT', 500 + floor(random()*200)::int, 'WAREHOUSE-C', 'BOOST-C-' || sid::text, timezone('utc', now()) - interval '10 days');
    END LOOP;

    -- Chennai: boost a bit 
    FOREACH sid IN ARRAY sku_ids LOOP
        INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
        VALUES (sid, 'STOCK_RECEIPT', 300 + floor(random()*100)::int, 'WAREHOUSE-D', 'BOOST-D-' || sid::text, timezone('utc', now()) - interval '5 days');
    END LOOP;

    -- Pune: manufacturing, moderate stock
    FOREACH sid IN ARRAY sku_ids LOOP
        INSERT INTO public.stock_ledger (sku_id, transaction_type, quantity, location, reference_id, created_at)
        VALUES (sid, 'STOCK_RECEIPT', 200 + floor(random()*100)::int, 'WAREHOUSE-E', 'BOOST-E-' || sid::text, timezone('utc', now()) - interval '7 days');
    END LOOP;
END $$;
