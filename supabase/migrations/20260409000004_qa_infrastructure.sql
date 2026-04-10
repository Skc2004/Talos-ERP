-- QA & Reliability Phase: Test Logging Infrastructure

-- 1. Test Results Log (captures CI/test run outcomes)
CREATE TABLE public.test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL,           -- Unique run identifier
    suite VARCHAR(50) NOT NULL,             -- 'JAVA_UNIT', 'PYTHON_AI', 'E2E_PLAYWRIGHT', 'CHAOS'
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    pass_rate DECIMAL(5, 2),                -- Percentage
    avg_response_ms DECIMAL(10, 2),         -- Average API response time
    execution_time_s DECIMAL(10, 2),        -- Total suite execution time
    notes TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ML Audit Trail (tracks model accuracy over time to detect drift)
CREATE TABLE public.ml_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,       -- 'prophet_demand', 'distilbert_sentiment', 'zscore_thermal'
    sku_id UUID REFERENCES public.sku_master(id),
    mape DECIMAL(8, 4),                     -- Mean Absolute Percentage Error
    rmse DECIMAL(10, 4),                    -- Root Mean Squared Error
    sample_size INTEGER,
    drift_detected BOOLEAN DEFAULT FALSE,   -- True if MAPE > threshold
    notes TEXT,
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Realtime for live dashboard monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ml_audit;

-- 4. Index for fast dashboard queries
CREATE INDEX idx_test_logs_suite_time ON public.test_logs(suite, executed_at);
CREATE INDEX idx_ml_audit_model_time ON public.ml_audit(model_name, audited_at);
