-- Enable RLS on iot_telemetry and add public read access
ALTER TABLE public.iot_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read telemetry" ON public.iot_telemetry FOR SELECT USING (true);

-- Allow the IoT simulator (service_role) to insert
CREATE POLICY "Service can insert telemetry" ON public.iot_telemetry FOR INSERT WITH CHECK (true);
