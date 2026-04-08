-- Tech Community Feed Schema (Rerun-Safe Version)

-- 1. Table for Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT, -- 'image' or 'video'
    category TEXT DEFAULT 'general_tech',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for Post Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- 3. Table for Post Comments
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 5. Cleanup Old Policies (Prevent "already exists" errors)
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can see likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Anyone can see comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.post_comments;

-- 6. Create Policies
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can see likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own likes" ON public.post_likes FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can see comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own comments" ON public.post_comments FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 7. Functions & Triggers
DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
CREATE OR REPLACE FUNCTION public.handle_post_like_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_post_like_change AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.handle_post_like_change();

DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;
CREATE OR REPLACE FUNCTION public.handle_post_comment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_post_comment_change AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.handle_post_comment_change();

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);

-- 9. Realtime Configuration
-- Add the feed tables to the existing realtime publication
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
COMMIT;
