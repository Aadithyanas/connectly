-- Engagement Fix for Tech Community Feed
-- Explicitly allowing INSERT for likes and comments by any authenticated user

-- 1. Refresh Likes Policies
DROP POLICY IF EXISTS "Anyone can see likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.post_likes;

CREATE POLICY "Anyone can see likes" 
ON public.post_likes FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Users can insert their own likes" 
ON public.post_likes FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" 
ON public.post_likes FOR DELETE 
TO authenticated USING (auth.uid() = user_id);

-- 2. Refresh Comments Policies
DROP POLICY IF EXISTS "Anyone can see comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.post_comments;

CREATE POLICY "Anyone can see comments" 
ON public.post_comments FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Users can insert their own comments" 
ON public.post_comments FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own comments" 
ON public.post_comments FOR ALL 
TO authenticated USING (auth.uid() = user_id);

-- 3. Safety Check for Triggers
-- The triggers should be SECURITY DEFINER which they already are in tech_community_schema.sql
