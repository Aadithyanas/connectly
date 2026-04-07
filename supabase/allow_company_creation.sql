-- Allow authenticated users to add new companies to the database
-- This removes the "Contact Admin" blocker during onboarding.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies are viewable by all users" ON public.companies;
CREATE POLICY "Companies are viewable by all users" 
ON public.companies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" 
ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
