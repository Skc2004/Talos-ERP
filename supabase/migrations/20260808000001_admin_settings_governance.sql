-- Admin settings (key-value config store)
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'general',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA definitions
CREATE TABLE IF NOT EXISTS sla_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    lead_source TEXT,
    lead_stage TEXT,
    response_hours INT NOT NULL DEFAULT 24,
    escalation_hours INT NOT NULL DEFAULT 48,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow rules (automation engine)
CREATE TABLE IF NOT EXISTS workflow_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL CHECK (trigger_event IN ('LEAD_CREATED','LEAD_STAGE_CHANGED','LEAD_SCORE_UPDATED','PROJECT_STATUS_CHANGED','QA_COMPLETED','TIME_LOGGED')),
    condition_json JSONB NOT NULL DEFAULT '{}',
    action_type TEXT NOT NULL CHECK (action_type IN ('AUTO_ASSIGN','SEND_NOTIFICATION','CHANGE_STATUS','ESCALATE','CREATE_TASK')),
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    channel TEXT DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP','EMAIL','BOTH')),
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_settings_all ON admin_settings FOR ALL USING (true);

ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_definitions_all ON sla_definitions FOR ALL USING (true);

ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_rules_all ON workflow_rules FOR ALL USING (true);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_all ON notification_preferences FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_event ON workflow_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_event ON notification_preferences(event_type);

-- Seed data
INSERT INTO admin_settings (setting_key, setting_value, category) VALUES
('pipeline_stages', '["NEW", "CONTACTED", "QUOTED", "NEGOTIATING", "WON", "LOST"]'::jsonb, 'crm'),
('lead_sources', '["WEBSITE", "REFERRAL", "COLD_CALL", "TRADE_SHOW", "LINKEDIN", "PARTNER"]'::jsonb, 'crm')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO sla_definitions (name, lead_source, lead_stage, response_hours, escalation_hours, priority) VALUES
('Hot Lead SLA', NULL, 'NEW', 4, 8, 'HIGH'),
('Standard Lead SLA', NULL, 'NEW', 24, 48, 'MEDIUM'),
('Cold Lead SLA', NULL, 'NEW', 72, 120, 'LOW');

INSERT INTO workflow_rules (name, trigger_event, condition_json, action_type, action_config) VALUES
('Auto Assign High Score Leads', 'LEAD_SCORE_UPDATED', '{"min_score": 80}', 'AUTO_ASSIGN', '{"team": "Sales"}'),
('Escalate Overdue SLAs', 'PROJECT_STATUS_CHANGED', '{"status": "OVERDUE"}', 'ESCALATE', '{"notify": "Manager"}');

INSERT INTO notification_preferences (event_type, channel) VALUES
('LEAD_CREATED', 'BOTH'),
('LEAD_WON', 'BOTH'),
('QA_FAILED', 'IN_APP'),
('PROJECT_OVERDUE', 'EMAIL'),
('SLA_BREACH', 'BOTH');
