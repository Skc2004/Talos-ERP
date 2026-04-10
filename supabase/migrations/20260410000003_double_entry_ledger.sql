-- =====================================================
-- Phase 2b: Immutable Double-Entry Bookkeeping Ledger
-- =====================================================

-- 1. Chart of Accounts — foundation for double-entry
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    parent_code VARCHAR(20) REFERENCES public.chart_of_accounts(code),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed standard accounts
INSERT INTO public.chart_of_accounts (code, name, account_type) VALUES
    ('1000', 'Cash & Bank', 'ASSET'),
    ('1100', 'Accounts Receivable', 'ASSET'),
    ('1200', 'Inventory', 'ASSET'),
    ('2000', 'Accounts Payable', 'LIABILITY'),
    ('2100', 'Tax Payable', 'LIABILITY'),
    ('3000', 'Retained Earnings', 'EQUITY'),
    ('4000', 'Sales Revenue', 'REVENUE'),
    ('4100', 'Service Revenue', 'REVENUE'),
    ('5000', 'Cost of Goods Sold', 'EXPENSE'),
    ('5100', 'Payroll Expense', 'EXPENSE'),
    ('5200', 'Rent Expense', 'EXPENSE'),
    ('5300', 'Logistics Expense', 'EXPENSE'),
    ('5400', 'Marketing Expense', 'EXPENSE'),
    ('5500', 'General & Admin', 'EXPENSE')
ON CONFLICT (code) DO NOTHING;

-- 2. Add journal entry grouping to general_ledger
ALTER TABLE public.general_ledger
    ADD COLUMN IF NOT EXISTS journal_entry_id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reversed_by_entry_id UUID,
    ADD COLUMN IF NOT EXISTS posted_by UUID;

-- 3. Prevent UPDATE on general_ledger — append-only (GAAP/SOX compliance)
CREATE OR REPLACE FUNCTION public.prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'General ledger records are immutable. Use reversing journal entries for corrections.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate to be idempotent
DROP TRIGGER IF EXISTS prevent_gl_update ON public.general_ledger;
CREATE TRIGGER prevent_gl_update
    BEFORE UPDATE ON public.general_ledger
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_modification();

DROP TRIGGER IF EXISTS prevent_gl_delete ON public.general_ledger;
CREATE TRIGGER prevent_gl_delete
    BEFORE DELETE ON public.general_ledger
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_modification();

-- 4. Function to create a reversing journal entry (the ONLY way to "correct" a ledger entry)
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(original_entry_id UUID)
RETURNS UUID AS $$
DECLARE
    new_journal_id UUID := gen_random_uuid();
    rec RECORD;
BEGIN
    -- Mark original entries as reversed (temporarily disable trigger)
    ALTER TABLE public.general_ledger DISABLE TRIGGER prevent_gl_update;
    
    UPDATE public.general_ledger
    SET is_reversed = TRUE, reversed_by_entry_id = new_journal_id
    WHERE journal_entry_id = original_entry_id;
    
    ALTER TABLE public.general_ledger ENABLE TRIGGER prevent_gl_update;

    -- Create reversing entries (swap debit/credit)
    FOR rec IN
        SELECT account_code, debit, credit, sku_id, description
        FROM public.general_ledger
        WHERE journal_entry_id = original_entry_id AND is_reversed = TRUE
    LOOP
        INSERT INTO public.general_ledger (journal_entry_id, account_code, debit, credit, sku_id, description, transaction_date)
        VALUES (
            new_journal_id,
            rec.account_code,
            rec.credit,   -- Swap: old credit becomes new debit
            rec.debit,    -- Swap: old debit becomes new credit
            rec.sku_id,
            'REVERSAL: ' || COALESCE(rec.description, ''),
            NOW()
        );
    END LOOP;

    RETURN new_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Balance validation view — ensures every journal entry is balanced
CREATE OR REPLACE VIEW public.unbalanced_journal_entries AS
SELECT
    journal_entry_id,
    SUM(debit) AS total_debit,
    SUM(credit) AS total_credit,
    SUM(debit) - SUM(credit) AS imbalance
FROM public.general_ledger
GROUP BY journal_entry_id
HAVING SUM(debit) != SUM(credit);

-- 6. Trial Balance view — real-time accounting health
CREATE OR REPLACE VIEW public.trial_balance AS
SELECT
    gl.account_code,
    coa.name AS account_name,
    coa.account_type,
    SUM(gl.debit) AS total_debit,
    SUM(gl.credit) AS total_credit,
    SUM(gl.debit) - SUM(gl.credit) AS balance
FROM public.general_ledger gl
JOIN public.chart_of_accounts coa ON gl.account_code = coa.code
WHERE gl.is_reversed = FALSE
GROUP BY gl.account_code, coa.name, coa.account_type
ORDER BY gl.account_code;

-- 7. RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read chart of accounts" ON public.chart_of_accounts FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Only admins can modify chart of accounts" ON public.chart_of_accounts FOR ALL
USING (public.user_role() = 'SUPER_ADMIN');
