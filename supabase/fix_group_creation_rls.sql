-- Fix: Allow group creator to add members to the chat
-- Resolves "new row violates row level security policy" during group creation

DROP POLICY IF EXISTS "chat_members_insert_policy" ON "public"."chat_members";

CREATE POLICY "chat_members_insert_policy" ON "public"."chat_members"
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id) OR
  (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_members.chat_id
    AND chats.created_by = auth.uid()
  ))
);
