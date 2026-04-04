-- ============================================
-- Add Reply & Forward support to messages
-- Run this in Supabase SQL Editor
-- ============================================

-- Add reply_to column for message replies
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add forwarded_from column to track forwarded messages  
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS forwarded BOOLEAN DEFAULT false;
