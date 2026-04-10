-- Phase 4: Talos Enterprise Workflow & Financial Expansion

-- 1. HR Employees Table (Map Supabase Auth users to physical entities)
CREATE TABLE public.hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Can map to auth.users if needed
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    department VARCHAR(100),
    role VARCHAR(100) DEFAULT 'OPERATOR',
    hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed some mock employees for immediate CRM usage
INSERT INTO public.hr_employees (name, email, department, role) VALUES
('Jane Doe', 'jane.doe@talos.com', 'Sales', 'SR_ACCOUNT_EXEC'),
('Mark Smith', 'mark.smith@talos.com', 'Assembly', 'SHIFT_LEAD'),
('Sarah Connor', 'sarah.c@talos.com', 'Finance', 'CFO');

-- 2. Link CRM & Projects to HR Employees
-- If existing data has bad UUIDs since we mocked it, we just update the constraint.
-- Because previous rows might have null or unstructured UUIDs, we don't enforce strict FK for backwards compatibility on 'assigned_to', but we recommend joining against hr_employees.

-- 3. Sales Orders Ingestion Table
CREATE TABLE public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    customer_name VARCHAR(200),
    sku_id UUID REFERENCES public.sku_master(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount_amount DECIMAL(15, 2) DEFAULT 0.00,
    net_revenue DECIMAL(15, 2) GENERATED ALWAYS AS ((quantity * unit_price) - discount_amount) STORED,
    channel VARCHAR(100) DEFAULT 'MANUAL_CSV', -- e.g., 'SHOPIFY', 'API', 'CSV'
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Financial active accounting engine
CREATE TABLE public.fin_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description VARCHAR(300) NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'PAYROLL', 'RENT', 'LOGISTICS', 'MARKETING'
    amount DECIMAL(15, 2) NOT NULL,
    expense_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    logged_by UUID, -- HR employee who logged it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.fin_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_type VARCHAR(100) NOT NULL, -- 'VAT', 'STATE_TAX', 'CORPORATE_INCOME_TAX'
    related_sale_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    taxable_amount DECIMAL(15, 2) NOT NULL,
    tax_rate_percent DECIMAL(5, 2) NOT NULL,
    computed_tax DECIMAL(15, 2) GENERATED ALWAYS AS (taxable_amount * (tax_rate_percent / 100)) STORED,
    date_assessed DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' -- PENDING, PAID
);

-- 5. RLS Policies for new tables
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_taxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read employees" ON public.hr_employees FOR SELECT USING (public.user_role() IS NOT NULL);
CREATE POLICY "Everyone can read sales" ON public.sales_orders FOR SELECT USING (public.user_role() IS NOT NULL);
CREATE POLICY "Admins can write sales" ON public.sales_orders FOR ALL USING (public.user_role() IN ('SUPER_ADMIN', 'PLANNER'));
CREATE POLICY "Admins can view expenses" ON public.fin_expenses FOR SELECT USING (public.user_role() IN ('SUPER_ADMIN', 'PLANNER'));
CREATE POLICY "Admins can log expenses" ON public.fin_expenses FOR ALL USING (public.user_role() IN ('SUPER_ADMIN', 'PLANNER'));
CREATE POLICY "Admins can view taxes" ON public.fin_taxes FOR SELECT USING (public.user_role() IN ('SUPER_ADMIN', 'PLANNER'));

-- 6. Publish to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_expenses;

-- Add a Realtime Notification trigger for Sales
CREATE TRIGGER trg_security_audit_sales
AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.track_ledger_changes();
