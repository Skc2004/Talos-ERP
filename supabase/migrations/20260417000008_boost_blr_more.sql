-- Bangalore still has negative net stock from redistribution. Add large receipts.
INSERT INTO public.stock_ledger(sku_id,transaction_type,quantity,location,reference_id,created_at)
VALUES
('11111111-1111-1111-1111-111111111111','STOCK_RECEIPT',1500,'WAREHOUSE-C','BOOST-C4-E','2026-04-01'),
('22222222-2222-2222-2222-222222222222','STOCK_RECEIPT',1200,'WAREHOUSE-C','BOOST-C4-M','2026-04-01'),
('33333333-3333-3333-3333-333333333333','STOCK_RECEIPT',1000,'WAREHOUSE-C','BOOST-C4-R','2026-04-01');
