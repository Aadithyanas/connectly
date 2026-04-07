-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL UNIQUE, -- e.g., 'google.com'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add some seed data to companies
INSERT INTO public.companies (name, domain)
VALUES 
  ('Google', 'google.com'),
  ('TCS', 'tcs.com'),
  ('Microsoft', 'microsoft.com'),
  ('Amazon', 'amazon.com'),
  ('Meta', 'meta.com'),
  ('Connectly Inc.', 'connectly.io')
ON CONFLICT (name) DO NOTHING;

-- 3. Update Profiles Table with Role-Based Fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('student', 'professional')),
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS college_name TEXT,
ADD COLUMN IF NOT EXISTS job_role TEXT,
ADD COLUMN IF NOT EXISTS experience_years INTEGER,
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS availability_status BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 0 CHECK (verification_level BETWEEN 0 AND 3),
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS github TEXT,
ADD COLUMN IF NOT EXISTS portfolio TEXT;

-- 4. Enable RLS on Companies (Viewable by all authenticated users)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Companies are viewable by all users" ON public.companies;
CREATE POLICY "Companies are viewable by all users" 
ON public.companies FOR SELECT TO authenticated USING (true);

-- 5. Updated handle_new_user trigger is not strictly necessary for logic, 
-- but we might want to ensure verification_level starts at 0 (already handled by default).

-- RLS Update: Only show professionals in search if they are verified (Level 1+) and available
-- This will be enforced primarily in the application logic for better UX, 
-- but we keep the profiles table readable for all (already exists).
