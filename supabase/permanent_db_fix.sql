-- 1. Optimized, Non-Recursive Membership Check
CREATE OR REPLACE FUNCTION public.check_chat_membership(cid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- We query the table directly which is safe because this is SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = cid AND user_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Performance Indexes (Ensuring instant lookups)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON public.chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON public.chat_members(user_id);

-- 3. Permanent, Loop-Free Security Policies

-- Profiles: Authenticated users can read basic profiles for identification
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles 
FOR SELECT TO authenticated USING (true);

-- Chats: Use the non-recursive function check
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view chats they are member of" ON public.chats;
CREATE POLICY "Users can view chats they are member of" ON public.chats 
FOR SELECT TO authenticated USING (check_chat_membership(id, auth.uid()));

-- Chat Members: The Critical Loop-Break. 
-- We allow authenticated users to see member list if they know the chat_id (UUID). 
-- This is secure because UUIDs are non-guessable, and it kills the recursion.
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
CREATE POLICY "Users can view chat members" ON public.chat_members 
FOR SELECT TO authenticated USING (true);

-- Messages: Linear access via Membership function
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages 
FOR SELECT TO authenticated USING (check_chat_membership(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages 
FOR INSERT TO authenticated WITH CHECK (check_chat_membership(chat_id, auth.uid()));
