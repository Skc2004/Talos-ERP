-- Migration to create Real-time Webhooks for Event-Driven AI Triggers

-- 1. Enable the pg_net extension to make HTTP requests from inside Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION trigger_ai_forecast_retrain()
RETURNS TRIGGER AS $$
DECLARE
  api_gateway_url TEXT := 'http://host.docker.internal:8000/forecasts/retrain/';
  request_id BIGINT;
BEGIN
  -- We only want to trigger retrains when stock is issued (sold/used)
  IF NEW.transaction_type = 'STOCK_ISSUE' THEN
    
    -- Make a non-blocking asynchronous HTTP POST to the Python AI Gateway
    -- We pass the sku_id that was just updated
    SELECT net.http_post(
        url := api_gateway_url || NEW.sku_id::TEXT,
        body := '{}'::JSONB
    ) INTO request_id;

    -- Store the req ID in logs if needed, but we keep it asynchronous
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the Trigger to the LEDGER
DROP TRIGGER IF EXISTS on_stock_issue_trigger ON public.stock_ledger;

CREATE TRIGGER on_stock_issue_trigger
  AFTER INSERT ON public.stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ai_forecast_retrain();
