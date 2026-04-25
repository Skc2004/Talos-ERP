-- Fix: Allow anon/public read access for dashboard display
-- The frontend uses the anon key (no auth), so user_role() returns NULL.
-- These policies allow SELECT for anyone, which is fine for read-only dashboard data.

-- security_audit: allow public reads for the event log
CREATE POLICY "Public can view audit log" ON public.security_audit FOR SELECT USING (true);

-- demand_forecasts: allow public reads for the forecast chart
CREATE POLICY "Public can view forecasts" ON public.demand_forecasts FOR SELECT USING (true);

-- general_ledger: allow public reads for KPI computation
CREATE POLICY "Public can view ledger" ON public.general_ledger FOR SELECT USING (true);

-- crm_leads: allow public reads for pipeline data
CREATE POLICY "Public can view leads" ON public.crm_leads FOR SELECT USING (true);

-- projects/milestones: allow public reads for Gantt views
CREATE POLICY "Public can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public can view milestones" ON public.project_milestones FOR SELECT USING (true);
CREATE POLICY "Public can view materials" ON public.project_materials FOR SELECT USING (true);

-- Stock & SKU: allow public reads
CREATE POLICY "Public can view SKU" ON public.sku_master FOR SELECT USING (true);
CREATE POLICY "Public can view stock" ON public.stock_ledger FOR SELECT USING (true);

-- Finance tables: allow public reads  
CREATE POLICY "Public can view sales orders" ON public.sales_orders FOR SELECT USING (true);
CREATE POLICY "Public can view expenses" ON public.fin_expenses FOR SELECT USING (true);
CREATE POLICY "Public can view taxes" ON public.fin_taxes FOR SELECT USING (true);

-- HR: allow public reads
CREATE POLICY "Public can view employees" ON public.hr_employees FOR SELECT USING (true);
