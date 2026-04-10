-- Phase 1 & 2: Database Primitives & RLS for Distributed ERP

-- Create ENUM types for status
CREATE TYPE po_status AS ENUM ('DRAFT', 'APPROVED', 'RECEIVED', 'CLOSED');
CREATE TYPE transaction_type AS ENUM ('GOODS_INWARD', 'STOCK_ISSUE', 'FINISHED_GOODS_ENTRY', 'STOCK_ADJUSTMENT');

-- 1. SKU Master Table
CREATE TABLE public.sku_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    dimensions_cm VARCHAR(50),
    weight_kg DECIMAL(10, 2),
    lead_time_days INTEGER DEFAULT 1,
    reorder_point INTEGER DEFAULT 0,
    preferred_vendor_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Stock Ledger Table (The literal source of truth for transactions)
CREATE TABLE public.stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES public.sku_master(id),
    transaction_type transaction_type NOT NULL,
    quantity INTEGER NOT NULL, -- positive for inwards, negative for issues
    location VARCHAR(100),
    reference_id VARCHAR(255), -- PO number or Order ID
    user_id UUID, -- References auth.users implicitly
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Purchase Orders Table
CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    vendor_id UUID, 
    status po_status DEFAULT 'DRAFT',
    total_amount DECIMAL(15, 2),
    created_by UUID,
    approved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Demand Forecasts Table (Insight Mantra write-back)
CREATE TABLE public.demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id UUID NOT NULL REFERENCES public.sku_master(id),
    forecasted_demand INTEGER NOT NULL,
    confidence_interval DECIMAL(5, 2),
    target_date DATE NOT NULL,
    human_override BOOLEAN DEFAULT FALSE,
    override_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (ROW LEVEL SECURITY) implementation

-- Enable RLS
ALTER TABLE public.sku_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;

-- Helper function to check roles from JWT custom claims
CREATE OR REPLACE FUNCTION public.user_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'user_role', '')::text;
$$ LANGUAGE SQL STABLE;

-- WAREHOUSE_OP Policies
-- Can view SKU Master
CREATE POLICY "Warehouse Ops can view SKUs" ON public.sku_master FOR SELECT 
USING (public.user_role() IN ('WAREHOUSE_OP', 'PLANNER', 'SUPER_ADMIN'));

-- Can only INSERT into stock ledger (cannot update history)
CREATE POLICY "Warehouse Ops can log stock" ON public.stock_ledger FOR INSERT 
WITH CHECK (public.user_role() IN ('WAREHOUSE_OP', 'SUPER_ADMIN'));

CREATE POLICY "Warehouse Ops can view ledger" ON public.stock_ledger FOR SELECT 
USING (public.user_role() IN ('WAREHOUSE_OP', 'PLANNER', 'SUPER_ADMIN'));

-- PLANNER Policies
-- Planners can do all PO operations
CREATE POLICY "Planners can manage POs" ON public.purchase_orders FOR ALL 
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

-- Planners can override forecasts
CREATE POLICY "Planners can update forecasts" ON public.demand_forecasts FOR UPDATE 
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

CREATE POLICY "Planners can view forecasts" ON public.demand_forecasts FOR SELECT 
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN', 'WAREHOUSE_OP'));

-- Create stock aggregation view for easier frontend consumption
CREATE VIEW public.current_stock AS
SELECT sku_id, sum(quantity) as available_quantity
FROM public.stock_ledger
GROUP BY sku_id;

-- Ensure Realtime is enabled for the tables we care about
alter publication supabase_realtime add table public.stock_ledger;
alter publication supabase_realtime add table public.sku_master;
alter publication supabase_realtime add table public.demand_forecasts;
