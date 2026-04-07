-- Patch: Onboarding system fixes
-- Run this once in the Supabase SQL editor

-- 1. Add 'course' column for student profiles (if not exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS course TEXT;

-- 2. Update handle_new_user trigger to be explicit about defaults
-- This prevents race conditions on first profile load
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    avatar_url,
    verification_level,
    availability_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    0,    -- Always start as 'new user'
    true  -- Available by default
  )
  ON CONFLICT (id) DO NOTHING; -- Safe re-run
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (DROP + CREATE is safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Backfill: set verification_level = 0 for any existing profiles that are NULL
UPDATE public.profiles
SET verification_level = 0
WHERE verification_level IS NULL;

-- 4. Confirmed: all required columns exist in profiles table
-- role, company_id, college_name, course, job_role, experience_years,
-- skills, availability_status, verification_level, linkedin, github, portfolio
-- (These were added in onboarding_tables.sql already)
