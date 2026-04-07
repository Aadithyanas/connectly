------------------------------------------------------------------
-- 🛡️ PHASE 2: FINAL HANGING RESOLUTION (REPORTS & MESSAGES)
------------------------------------------------------------------

-- 1. Create Reports Table (Fixes the "Submitting..." infinite hang)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reporter_id UUID REFERENCES auth.users(id),
    reported_id UUID REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    description TEXT
);

-- Enable RLS for Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow users to save reports (This stops the "Submitting" spinner)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.reports;
CREATE POLICY "Enable insert for authenticated users" ON public.reports 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

------------------------------------------------------------------
-- ⚡ 2. FIX MESSAGE SKELETONS (Final Linear Performance Rule)
------------------------------------------------------------------

-- Use a non-recursive membership check to load messages instantly
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages 
FOR SELECT TO authenticated USING (check_chat_membership(chat_id, auth.uid()));

-- Performance Indexes (Sub-millisecond access)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON public.chat_members(chat_id);
