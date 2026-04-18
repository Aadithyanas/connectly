-- ============================================
-- FIX: Drop ALL existing policies, then recreate
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- Step 1: Drop ALL policies on every table (nuclear reset)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- Step 2: Create the helper function (breaks recursion)
CREATE OR REPLACE FUNCTION public.check_chat_membership(cid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = cid AND user_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Step 4: Profiles policies
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Step 5: Chats policies (SELECT + INSERT)
CREATE POLICY "chats_select" ON public.chats
  FOR SELECT TO authenticated
  USING (check_chat_membership(id, auth.uid()));

CREATE POLICY "chats_insert" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Step 6: Chat Members policies (SELECT + INSERT)
CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated
  USING (check_chat_membership(chat_id, auth.uid()));

CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Step 7: Messages policies (SELECT + INSERT)
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (check_chat_membership(chat_id, auth.uid()));

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (check_chat_membership(chat_id, auth.uid()));
