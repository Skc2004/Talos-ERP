-- Phase 1: CRM Activity Timeline + Production Time Entries
-- =========================================================

-- CRM Activities: tracks calls, emails, meetings, notes per lead
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK')),
    description TEXT NOT NULL,
    created_by UUID,
    follow_up_date TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX idx_crm_activities_followup ON crm_activities(follow_up_date) WHERE follow_up_date IS NOT NULL AND is_completed = FALSE;

-- Time Entries: tracks actual hours worked on projects
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES hr_employees(id),
    hours NUMERIC(6,2) NOT NULL CHECK (hours > 0),
    description TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);

-- Auto-update project actual_hours when time is logged
CREATE OR REPLACE FUNCTION update_project_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE projects
    SET actual_hours = (
        SELECT COALESCE(SUM(hours), 0) FROM time_entries WHERE project_id = NEW.project_id
    ),
    updated_at = NOW()
    WHERE id = NEW.project_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_time_entry_sync
AFTER INSERT OR UPDATE OR DELETE ON time_entries
FOR EACH ROW EXECUTE FUNCTION update_project_actual_hours();

-- RLS Policies for new tables
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view activities" ON crm_activities FOR SELECT USING (true);
CREATE POLICY "Public can insert activities" ON crm_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update activities" ON crm_activities FOR UPDATE USING (true);

CREATE POLICY "Public can view time entries" ON time_entries FOR SELECT USING (true);
CREATE POLICY "Public can insert time entries" ON time_entries FOR INSERT WITH CHECK (true);
