-- OPTIMIZED SUPABASE DB FIX FOR SLOW CHAT LOADING (HANGS/MINUTES LONG LOAD)
-- The reason your queries take minutes is because Supabase's PostgREST evaluates
-- VOLATILE RLS functions on every joined row (N+1 query problem).
-- By using direct `EXISTS` with indexed tables, Postgres can optimize the join.

-- 1. Performance Indexes (Ensuring instant lookups)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at_desc ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON public.messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_user ON public.chat_members(chat_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON public.chat_members(user_id);

-- 2. Permanent, Loop-Free Security Policies

-- Profiles: Authenticated users can read basic profiles for identification
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles 
FOR SELECT TO authenticated USING (true);

-- Chat Members: The base of permissions.
-- We allow authenticated users to see member lists. 
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
CREATE POLICY "Users can view chat members" ON public.chat_members 
FOR SELECT TO authenticated USING (true);

-- Chats: Use direct EXISTS for index optimization
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view chats they are member of" ON public.chats;
CREATE POLICY "Users can view chats they are member of" ON public.chats 
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = id AND chat_members.user_id = auth.uid()
  )
);

-- Messages: Direct EXISTS for linear index access
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages 
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages 
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
  )
);

-- Keep the helper function just in case your API uses it elsewhere, but make it STABLE and SQL
CREATE OR REPLACE FUNCTION public.check_chat_membership(cid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = cid AND user_id = uid
  );
$$;
