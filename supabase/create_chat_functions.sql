-- ============================================
-- NUCLEAR FIX: Create chat via database function
-- This bypasses RLS entirely using SECURITY DEFINER
-- Run this in Supabase SQL Editor
-- ============================================

-- Function to create a 1-on-1 DM chat
CREATE OR REPLACE FUNCTION public.create_dm_chat(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  current_user_id UUID;
  existing_chat_id UUID;
  new_chat_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if a DM already exists between these two users
  SELECT cm1.chat_id INTO existing_chat_id
  FROM chat_members cm1
  JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
  JOIN chats c ON c.id = cm1.chat_id
  WHERE cm1.user_id = current_user_id
    AND cm2.user_id = other_user_id
    AND c.is_group = false
  LIMIT 1;

  -- If chat exists, return it
  IF existing_chat_id IS NOT NULL THEN
    RETURN existing_chat_id;
  END IF;

  -- Create new chat
  INSERT INTO chats (is_group) VALUES (false) RETURNING id INTO new_chat_id;

  -- Add both members
  INSERT INTO chat_members (chat_id, user_id, role) VALUES
    (new_chat_id, current_user_id, 'admin'),
    (new_chat_id, other_user_id, 'member');

  RETURN new_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a group chat
CREATE OR REPLACE FUNCTION public.create_group_chat(group_name TEXT, member_ids UUID[])
RETURNS UUID AS $$
DECLARE
  current_user_id UUID;
  new_chat_id UUID;
  member_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create new group chat
  INSERT INTO chats (name, is_group) VALUES (group_name, true) RETURNING id INTO new_chat_id;

  -- Add creator as admin
  INSERT INTO chat_members (chat_id, user_id, role) VALUES (new_chat_id, current_user_id, 'admin');

  -- Add all members
  FOREACH member_id IN ARRAY member_ids LOOP
    INSERT INTO chat_members (chat_id, user_id, role) VALUES (new_chat_id, member_id, 'member');
  END LOOP;

  RETURN new_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
