-- ============================================
-- FIX: Message Tick System (Single ✓, Double ✓✓, Blue ✓✓)
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- 1. Ensure the UPDATE policy exists for messages
-- This allows chat members to update message status (sent → delivered → seen)
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.chat_id = messages.chat_id 
      AND chat_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_members.chat_id = messages.chat_id 
      AND chat_members.user_id = auth.uid()
    )
  );

-- 2. Add index on message status for faster tick queries
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_status ON public.messages(chat_id, status);

-- 3. Ensure the RPC functions exist with SECURITY DEFINER
-- mark_messages_delivered: sent → delivered (gray double tick)
CREATE OR REPLACE FUNCTION public.mark_messages_delivered(cid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages
  SET status = 'delivered'
  WHERE chat_id = cid
    AND sender_id != auth.uid()
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- mark_messages_seen: sent/delivered → seen (blue double tick)
CREATE OR REPLACE FUNCTION public.mark_messages_seen(cid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages
  SET status = 'seen'
  WHERE chat_id = cid
    AND sender_id != auth.uid()
    AND status IN ('sent', 'delivered');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- mark_all_messages_delivered: bulk delivery on app open
CREATE OR REPLACE FUNCTION public.mark_all_messages_delivered()
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages m
  SET status = 'delivered'
  FROM public.chat_members cm
  WHERE cm.user_id = auth.uid()
    AND cm.chat_id = m.chat_id
    AND m.sender_id != auth.uid()
    AND m.status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable Realtime for messages + profiles tables
-- Messages: needed for UPDATE events → tick changes
-- Profiles: needed for heartbeat updates → online status in chat header
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
