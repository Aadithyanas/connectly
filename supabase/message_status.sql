-- ============================================
-- Message Status Functions (Delivered + Seen ticks)
-- Run this in Supabase SQL Editor
-- ============================================

-- Allow message status updates (needed for tick system)
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE TO authenticated
  USING (check_chat_membership(chat_id, auth.uid()))
  WITH CHECK (check_chat_membership(chat_id, auth.uid()));

-- Function to mark all unread messages in a chat as "delivered"
CREATE OR REPLACE FUNCTION public.mark_messages_delivered(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.messages 
  SET status = 'delivered'
  WHERE chat_id = cid 
    AND sender_id != auth.uid()
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all messages in a chat as "seen"
CREATE OR REPLACE FUNCTION public.mark_messages_seen(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.messages 
  SET status = 'seen'
  WHERE chat_id = cid 
    AND sender_id != auth.uid()
    AND status IN ('sent', 'delivered');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
