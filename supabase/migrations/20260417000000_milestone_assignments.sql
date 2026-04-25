-- Modification: Add assigned_to for worker-task mapping in demo
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.hr_employees(id);

-- Seed existing milestones with mock employees
UPDATE public.project_milestones SET assigned_to = (SELECT id FROM public.hr_employees WHERE name = 'Mark Smith' LIMIT 1) WHERE assigned_to IS NULL AND task_name LIKE '%Procurement%';
UPDATE public.project_milestones SET assigned_to = (SELECT id FROM public.hr_employees WHERE name = 'Jane Doe' LIMIT 1) WHERE assigned_to IS NULL AND task_name NOT LIKE '%Procurement%';
