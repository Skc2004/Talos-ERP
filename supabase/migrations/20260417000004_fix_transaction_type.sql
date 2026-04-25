-- Fix: Change transaction_type column from custom Postgres enum to VARCHAR
-- so Hibernate can insert without explicit type casting
ALTER TABLE public.stock_ledger
  ALTER COLUMN transaction_type TYPE VARCHAR(50) USING transaction_type::TEXT;
