-- === SYSTEM RESET SCRIPT ===
-- Run this in the Supabase SQL Editor to wipe all user and chat data and start fresh

-- 1. Wipe all chat-related data
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.chat_members CASCADE;
TRUNCATE TABLE public.chats CASCADE;

-- 2. Wipe all statuses and privacy settings
TRUNCATE TABLE public.status_allowed_users CASCADE;
TRUNCATE TABLE public.statuses CASCADE;
TRUNCATE TABLE public.status_privacy CASCADE;

-- 3. Wipe all profiles
TRUNCATE TABLE public.profiles CASCADE;

-- 4. Delete all Authentication Users
-- This forces you to sign up again and re-trigger the default profile creation
DELETE FROM auth.users;

-- Note: We do NOT wipe the 'companies' table here since that is reference data for professionals.
-- If you want to wipe companies too, uncomment the line below:
-- TRUNCATE TABLE public.companies CASCADE;
