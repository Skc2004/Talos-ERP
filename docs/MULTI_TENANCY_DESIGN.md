# Multi-Tenancy Architecture Design — Talos ERP

> **Status: DEFERRED** — To be implemented when core single-tenant features are stable.

## Overview

Multi-tenancy allows Talos ERP to serve multiple companies (tenants) on the same infrastructure while maintaining strict data isolation at the database level.

## Schema Design

### Tenant Table
```sql
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'acme-corp'
    plan VARCHAR(50) DEFAULT 'FREE',     -- FREE, PRO, ENTERPRISE
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tenant Column Addition
Every transactional table gets a `tenant_id` column:

```sql
ALTER TABLE public.sku_master ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.stock_ledger ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.sales_orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.crm_leads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.projects ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fin_expenses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.general_ledger ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.hr_employees ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.purchase_orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
```

### RLS Policies
```sql
-- Helper function to extract tenant_id from JWT
CREATE OR REPLACE FUNCTION public.user_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'tenant_id', ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Example: SKU Master isolation
CREATE POLICY "Tenant isolation for SKUs" ON public.sku_master
USING (tenant_id = public.user_tenant_id());
```

### Signup Flow
1. New user signs up → creates a new Tenant
2. `tenant_id` is injected into `app_metadata` as a JWT custom claim
3. All subsequent API calls carry the tenant context

## Risks
- **Data migration**: All existing rows need a default `tenant_id` assigned
- **API changes**: Every write endpoint must inject `tenant_id` from JWT
- **Performance**: Composite indexes needed on `(tenant_id, ...)` for all queries

## Recommendation
Execute this as a dedicated "Phase 5" migration after all 8 core fixes are validated and stable.
