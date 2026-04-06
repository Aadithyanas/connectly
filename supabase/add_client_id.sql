-- Add client_id column to messages table for perfect de-duplication
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_id TEXT;

-- (Optional) Index it for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);
