-- =====================================================
-- Phase 2a: Foreign Key Enforcement & Data Sanitization
-- =====================================================

-- 1. Clean orphaned project_materials with invalid sku_id
DELETE FROM public.project_materials
WHERE sku_id NOT IN (SELECT id FROM public.sku_master);

-- 2. Clean orphaned assigned_to in crm_leads (not in hr_employees)
UPDATE public.crm_leads SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM public.hr_employees);

-- 3. Clean orphaned logged_by in fin_expenses
UPDATE public.fin_expenses SET logged_by = NULL
WHERE logged_by IS NOT NULL
  AND logged_by NOT IN (SELECT id FROM public.hr_employees);

-- 4. Clean orphaned created_by/approved_by in purchase_orders
UPDATE public.purchase_orders SET created_by = NULL
WHERE created_by IS NOT NULL
  AND created_by NOT IN (SELECT id FROM public.hr_employees);

UPDATE public.purchase_orders SET approved_by = NULL
WHERE approved_by IS NOT NULL
  AND approved_by NOT IN (SELECT id FROM public.hr_employees);

-- 5. Add FK constraints (idempotent: skip if already exists)

-- crm_leads.assigned_to → hr_employees
DO $$ BEGIN
    ALTER TABLE public.crm_leads
        ADD CONSTRAINT fk_crm_leads_assigned_to
        FOREIGN KEY (assigned_to) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- fin_expenses.logged_by → hr_employees
DO $$ BEGIN
    ALTER TABLE public.fin_expenses
        ADD CONSTRAINT fk_fin_expenses_logged_by
        FOREIGN KEY (logged_by) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- purchase_orders.created_by → hr_employees
DO $$ BEGIN
    ALTER TABLE public.purchase_orders
        ADD CONSTRAINT fk_po_created_by
        FOREIGN KEY (created_by) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- purchase_orders.approved_by → hr_employees
DO $$ BEGIN
    ALTER TABLE public.purchase_orders
        ADD CONSTRAINT fk_po_approved_by
        FOREIGN KEY (approved_by) REFERENCES public.hr_employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- general_ledger.sku_id → sku_master (RESTRICT: cannot delete SKU with ledger history)
-- First clean orphans
UPDATE public.general_ledger SET sku_id = NULL
WHERE sku_id IS NOT NULL
  AND sku_id NOT IN (SELECT id FROM public.sku_master);

DO $$ BEGIN
    ALTER TABLE public.general_ledger
        ADD CONSTRAINT fk_gl_sku_id
        FOREIGN KEY (sku_id) REFERENCES public.sku_master(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
