-- CRM & Project Management Module: Lead-to-Ledger Pipeline

-- 1. CRM Leads Table
CREATE TYPE lead_status AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST');

CREATE TABLE public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(200),
    contact_phone VARCHAR(50),
    company_name VARCHAR(200),
    potential_value DECIMAL(15, 2) DEFAULT 0.00,
    status lead_status DEFAULT 'NEW',
    source VARCHAR(100),              -- 'WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW'
    assigned_to UUID,                 -- Maps to auth.users
    ai_score DECIMAL(5, 2),           -- AI-generated lead score (0-100)
    notes TEXT,
    converted_project_id UUID,        -- Set when lead is converted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Projects Table (Shop Floor Kanban)
CREATE TYPE project_status AS ENUM ('BACKLOG', 'PLANNING', 'IN_PROGRESS', 'QA', 'SHIPPED', 'CANCELLED');

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.crm_leads(id),
    project_name VARCHAR(300) NOT NULL,
    client_name VARCHAR(200),
    deadline TIMESTAMP WITH TIME ZONE,
    status project_status DEFAULT 'BACKLOG',
    priority INTEGER DEFAULT 50,       -- 1=highest, 100=lowest
    estimated_hours DECIMAL(8, 2),
    actual_hours DECIMAL(8, 2) DEFAULT 0,
    estimated_cost DECIMAL(15, 2),
    machine_id VARCHAR(100),           -- Links to IoT machine for resource conflict detection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Project Milestones (Gantt-lite tasks)
CREATE TABLE public.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_name VARCHAR(300) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Project Material Requirements (BOM link)
CREATE TABLE public.project_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sku_id UUID NOT NULL REFERENCES public.sku_master(id),
    quantity_required INTEGER NOT NULL,
    quantity_reserved INTEGER DEFAULT 0,
    is_fulfilled BOOLEAN DEFAULT FALSE
);

-- 5. RLS Policies
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads" ON public.crm_leads FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Planners can manage leads" ON public.crm_leads FOR ALL
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Planners can manage projects" ON public.projects FOR ALL
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

CREATE POLICY "Authenticated users can view milestones" ON public.project_milestones FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Planners can manage milestones" ON public.project_milestones FOR ALL
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

CREATE POLICY "Authenticated users can view materials" ON public.project_materials FOR SELECT
USING (public.user_role() IS NOT NULL);

CREATE POLICY "Planners can manage materials" ON public.project_materials FOR ALL
USING (public.user_role() IN ('PLANNER', 'SUPER_ADMIN'));

-- 6. Performance Indexes
CREATE INDEX idx_leads_status ON public.crm_leads(status);
CREATE INDEX idx_leads_score ON public.crm_leads(ai_score DESC);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_deadline ON public.projects(deadline);
CREATE INDEX idx_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_materials_project ON public.project_materials(project_id);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_milestones;

-- 8. Deadline Slack Computation View
-- T_slack = deadline - (now + estimated_production_hours)
CREATE VIEW public.project_deadline_health AS
SELECT
    p.id,
    p.project_name,
    p.client_name,
    p.deadline,
    p.status,
    p.priority,
    p.estimated_hours,
    p.machine_id,
    EXTRACT(EPOCH FROM (p.deadline - (NOW() + (p.estimated_hours || ' hours')::interval))) / 3600.0 AS slack_hours,
    CASE
        WHEN p.deadline IS NULL THEN 'NO_DEADLINE'
        WHEN EXTRACT(EPOCH FROM (p.deadline - (NOW() + (p.estimated_hours || ' hours')::interval))) / 3600.0 < 0 THEN 'OVERDUE'
        WHEN EXTRACT(EPOCH FROM (p.deadline - (NOW() + (p.estimated_hours || ' hours')::interval))) / 3600.0 < 48 THEN 'AT_RISK'
        ELSE 'ON_TRACK'
    END AS deadline_status
FROM public.projects p
WHERE p.status NOT IN ('SHIPPED', 'CANCELLED');

-- 9. Resource Conflict Detection View
-- Identifies projects competing for the same machine in the same week
CREATE VIEW public.resource_conflicts AS
SELECT
    a.id AS project_a_id,
    a.project_name AS project_a_name,
    b.id AS project_b_id,
    b.project_name AS project_b_name,
    a.machine_id,
    a.deadline AS deadline_a,
    b.deadline AS deadline_b
FROM public.projects a
JOIN public.projects b ON a.machine_id = b.machine_id
    AND a.id < b.id
    AND a.status IN ('PLANNING', 'IN_PROGRESS')
    AND b.status IN ('PLANNING', 'IN_PROGRESS')
    AND ABS(EXTRACT(EPOCH FROM (a.deadline - b.deadline))) < 604800; -- within 7 days

-- 10. Seed CRM Data for Demo
INSERT INTO public.crm_leads (contact_name, contact_email, company_name, potential_value, status, source, ai_score, notes)
VALUES
('Rajesh Patel', 'rajesh@steelworks.in', 'Patel Steel Works', 250000.00, 'QUOTED', 'TRADE_SHOW', 87.5, 'High-volume order for custom brackets. Interested in Q3 delivery.'),
('Anjali Sharma', 'anjali@greenpack.co', 'GreenPack Solutions', 75000.00, 'NEW', 'WEBSITE', 62.0, 'Eco-friendly packaging inquiry. Needs HDPE granules.'),
('Michael Chen', 'mchen@globalparts.com', 'Global Parts Inc.', 500000.00, 'NEGOTIATING', 'REFERRAL', 94.2, 'Fortune 500 subsidiary. Multi-year contract potential.'),
('Priya Nair', 'priya@craftcollective.in', 'Craft Collective', 35000.00, 'CONTACTED', 'COLD_CALL', 41.0, 'Artisanal manufacturer. Small batch requirements.'),
('David Torres', 'dtorres@machineworld.us', 'MachineWorld USA', 180000.00, 'NEW', 'WEBSITE', 78.3, 'Industrial components. Needs precision tolerances.');

-- Seed Projects
INSERT INTO public.projects (lead_id, project_name, client_name, deadline, status, priority, estimated_hours, machine_id)
VALUES
((SELECT id FROM public.crm_leads WHERE contact_name = 'Rajesh Patel'), 'Custom Steel Brackets - Batch 500', 'Patel Steel Works', NOW() + INTERVAL '14 days', 'IN_PROGRESS', 10, 120.0, 'EXTRUDER-01'),
((SELECT id FROM public.crm_leads WHERE contact_name = 'Michael Chen'), 'Precision Components Phase 1', 'Global Parts Inc.', NOW() + INTERVAL '30 days', 'PLANNING', 5, 240.0, 'MOLDING-A3'),
((SELECT id FROM public.crm_leads WHERE contact_name = 'Anjali Sharma'), 'HDPE Packaging Prototype', 'GreenPack Solutions', NOW() + INTERVAL '7 days', 'BACKLOG', 30, 40.0, 'EXTRUDER-01');

-- Seed Milestones
INSERT INTO public.project_milestones (project_id, task_name, is_completed, due_date, sort_order)
SELECT p.id, m.task_name, m.is_completed, m.due_date, m.sort_order
FROM public.projects p
CROSS JOIN (
    VALUES
    ('Material Procurement', TRUE, CURRENT_DATE - 2, 1),
    ('Die Setup & Calibration', TRUE, CURRENT_DATE - 1, 2),
    ('Production Run', FALSE, CURRENT_DATE + 5, 3),
    ('Quality Inspection', FALSE, CURRENT_DATE + 8, 4),
    ('Packaging & Shipping', FALSE, CURRENT_DATE + 12, 5)
) AS m(task_name, is_completed, due_date, sort_order)
WHERE p.project_name = 'Custom Steel Brackets - Batch 500';

-- Seed Material Requirements
INSERT INTO public.project_materials (project_id, sku_id, quantity_required, quantity_reserved, is_fulfilled)
SELECT p.id, '33333333-3333-3333-3333-333333333333'::UUID, 500, 200, FALSE
FROM public.projects p WHERE p.project_name = 'HDPE Packaging Prototype';
