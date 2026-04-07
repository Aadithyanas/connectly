-- Creates an optimized batch function to mark all messages as delivered globally!
-- This replaces the slow loop in React that crashed the browser HTTP pool.

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

-- Keep the specific seen function optimized
CREATE OR REPLACE FUNCTION public.mark_messages_seen(cid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.messages 
  SET status = 'seen' 
  WHERE chat_id = cid AND sender_id != auth.uid() AND status != 'seen';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
