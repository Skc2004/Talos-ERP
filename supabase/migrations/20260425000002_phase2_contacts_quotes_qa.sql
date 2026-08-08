-- Phase 2: Contacts Directory, Quotation Builder, QA Checklists
-- ==============================================================

-- Contacts & Companies Directory
CREATE TABLE IF NOT EXISTS crm_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT CHECK (size IN ('STARTUP','SMB','MID_MARKET','ENTERPRISE')),
    website TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    designation TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_contacts_company ON crm_contacts(company_id);

-- Quotation Builder
CREATE TABLE IF NOT EXISTS crm_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 18.00,
    total NUMERIC(15,2) DEFAULT 0,
    valid_until DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_quotations_lead ON crm_quotations(lead_id);

-- QA Checklist Templates (admin-configurable)
CREATE TABLE IF NOT EXISTS qa_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QA Checklists (per project)
CREATE TABLE IF NOT EXISTS qa_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES qa_templates(id),
    items JSONB NOT NULL DEFAULT '[]',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_checklists_project ON qa_checklists(project_id);

-- RLS
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access companies" ON crm_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access contacts" ON crm_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access quotations" ON crm_quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access qa_templates" ON qa_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access qa_checklists" ON qa_checklists FOR ALL USING (true) WITH CHECK (true);

-- Seed default QA templates
INSERT INTO qa_templates (template_name, items) VALUES
('CNC Machining QA', '["Dimensional accuracy within ±0.05mm","Surface finish Ra < 1.6μm","No burrs or sharp edges","Material certification verified","Thread gauge check passed","Visual inspection clean"]'),
('Assembly QA', '["All components present per BOM","Torque specs met on fasteners","Electrical continuity verified","Alignment within spec","Lubrication applied","Final functional test passed"]'),
('General Manufacturing', '["Raw material inspection","In-process dimensional check","Surface treatment verified","Packaging integrity","Documentation complete","Customer spec compliance"]');
