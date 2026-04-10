-- =====================================================
-- Phase 1: RBAC Authentication & User Preferences
-- =====================================================

-- 1. Expand role options (safe: skip if exists)
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM (
        'SUPER_ADMIN', 'FINANCE', 'WAREHOUSE_OPERATOR', 'SALES', 'PLANNER', 'VIEWER'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. User Profiles — links auth.users to hr_employees with role
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    display_name VARCHAR(200),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. User Preferences — per-page settings (JSONB)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL,
    page_identifier VARCHAR(100) NOT NULL,
    settings_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(auth_user_id, page_identifier)
);

-- 4. RLS for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT
USING (auth.uid() = auth_user_id);

-- Users can update their own profile (display_name, avatar only — not role)
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Admins can read and manage all profiles
CREATE POLICY "Admins can manage all profiles" ON public.user_profiles FOR ALL
USING (public.user_role() = 'SUPER_ADMIN');

-- Service role (backend) can insert profiles on signup
CREATE POLICY "Service can insert profiles" ON public.user_profiles FOR INSERT
WITH CHECK (true);

-- 5. RLS for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 6. Auto-create user_profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (auth_user_id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'VIEWER')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Function to set user role claim in app_metadata (called by admin)
CREATE OR REPLACE FUNCTION public.set_user_role_claim(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
    -- Update the profile table
    UPDATE public.user_profiles SET role = new_role, updated_at = NOW()
    WHERE auth_user_id = target_user_id;
    
    -- Update hr_employees role if linked
    UPDATE public.hr_employees SET role = new_role
    WHERE auth_user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON public.user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_auth_page ON public.user_preferences(auth_user_id, page_identifier);

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
