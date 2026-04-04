-- 1. Tables for User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT DEFAULT 'Hey there! I am using Connectly.',
  status TEXT DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tables for Chats (One-to-One and Groups)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,             -- Null for 1-on-1, name for groups
  description TEXT,      -- For groups
  avatar_url TEXT,       -- For groups
  is_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for Chat Members (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.chat_members (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- 4. Table for Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image', 'video', 'document'
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'seen'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Row Level Security Logic
-- HELPER: Function to break recursion in RLS
CREATE OR REPLACE FUNCTION public.check_chat_membership(cid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = cid AND user_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5.1. Profiles: readable by all authenticated users
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 5.2. Chats: viewable if the user is a member
DROP POLICY IF EXISTS "Users can view chats they are member of" ON public.chats;
CREATE POLICY "Users can view chats they are member of" 
ON public.chats FOR SELECT TO authenticated
USING (check_chat_membership(id, auth.uid()));

DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
CREATE POLICY "Users can create chats" 
ON public.chats FOR INSERT TO authenticated 
WITH CHECK (true);

-- 5.3. Chat Members: viewable if the user is in that chat
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
CREATE POLICY "Users can view chat members" 
ON public.chat_members FOR SELECT TO authenticated
USING (check_chat_membership(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Users can join chats" ON public.chat_members;
CREATE POLICY "Users can join chats" 
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (true);

-- 5.4. Messages: viewable and insertable if member
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" 
ON public.messages FOR SELECT TO authenticated
USING (check_chat_membership(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" 
ON public.messages FOR INSERT TO authenticated
WITH CHECK (check_chat_membership(chat_id, auth.uid()));

-- 6. Trigger for profile creation on Auth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Realtime configuration
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.profiles, public.chats, public.chat_members;

-- 8. Storage: Media bucket setup
-- Run this in SQL editor to create bucket if not created via UI
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Storage RLS: allow authenticated users to upload and view media
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Allow authenticated views" ON storage.objects;
CREATE POLICY "Allow authenticated views" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'media');
