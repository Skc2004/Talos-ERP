-- =====================================================
-- Phase 8: Multi-Tenancy Architecture
-- =====================================================

-- 1. Create Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'FREE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a Default Tenant for existing data
INSERT INTO public.tenants (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default')
ON CONFLICT (slug) DO NOTHING;

-- 2. Add tenant_id to all transactional tables
DO $$ 
DECLARE 
    t_name text;
    tables_list text[] := ARRAY[
        'admin_settings', 'chart_of_accounts', 'crm_activities', 'crm_companies', 
        'crm_contacts', 'crm_leads', 'crm_quotations', 'demand_forecasts', 
        'fin_expenses', 'general_ledger', 'hr_employees', 'notification_preferences', 
        'project_assignments', 'project_milestones', 'project_risks', 'projects', 
        'purchase_orders', 'qa_checklists', 'sales_orders', 'sku_master', 
        'sla_definitions', 'stock_ledger', 'time_entries', 'warehouses', 'workflow_rules'
    ];
BEGIN 
    FOREACH t_name IN ARRAY tables_list 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT ''00000000-0000-0000-0000-000000000000'';', t_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id);', t_name, t_name);
    END LOOP;
END $$;

-- 3. Helper function to extract tenant_id from JWT
CREATE OR REPLACE FUNCTION public.user_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'tenant_id', ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- 4. Enable RLS and Tenant Isolation Policies
DO $$ 
DECLARE 
    t_name text;
    tables_list text[] := ARRAY[
        'admin_settings', 'chart_of_accounts', 'crm_activities', 'crm_companies', 
        'crm_contacts', 'crm_leads', 'crm_quotations', 'demand_forecasts', 
        'fin_expenses', 'general_ledger', 'hr_employees', 'notification_preferences', 
        'project_assignments', 'project_milestones', 'project_risks', 'projects', 
        'purchase_orders', 'qa_checklists', 'sales_orders', 'sku_master', 
        'sla_definitions', 'stock_ledger', 'time_entries', 'warehouses', 'workflow_rules'
    ];
BEGIN 
    FOREACH t_name IN ARRAY tables_list 
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
        
        -- Drop existing policy if it exists to be idempotent
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation for %I" ON public.%I;', t_name, t_name);
        
        -- Create tenant isolation policy
        EXECUTE format('CREATE POLICY "Tenant isolation for %I" ON public.%I USING (tenant_id = public.user_tenant_id());', t_name, t_name);
    END LOOP;
END $$;
