-- Support for Comment Replies (WhatsApp Style)

-- 1. Add the column to link a comment to another one
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.post_comments(id) ON DELETE SET NULL;

-- 2. Performance Index for fast fetching of threads
CREATE INDEX IF NOT EXISTS idx_post_comments_reply_to ON public.post_comments(reply_to_id);

-- 3. Security (Ensure RLS policies still apply)
-- The existing policy for "Users can insert their own comments" 
-- will automatically handle the new column since it's just an optional field.
