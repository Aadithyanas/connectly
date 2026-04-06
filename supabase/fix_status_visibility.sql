-- 1. Ensure all existing users have a status privacy record
INSERT INTO public.status_privacy (user_id, visibility)
SELECT id, 'everyone' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2. Add an explicit policy for the owner to manage their own statuses
DROP POLICY IF EXISTS "Users can always see their own statuses" ON public.statuses;
DROP POLICY IF EXISTS "Users can always manage their own statuses" ON public.statuses;
CREATE POLICY "Users can always manage their own statuses" 
ON public.statuses FOR ALL TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. FIX: Allow all authenticated users to SEE privacy settings
-- (Crucial so RLS can check if someone's status is 'everyone')
DROP POLICY IF EXISTS "Users can view all privacy settings" ON public.status_privacy;
CREATE POLICY "Users can view all privacy settings" 
ON public.status_privacy FOR SELECT TO authenticated USING (true);

-- 4. Simplified and robust visibility policy for statuses
DROP POLICY IF EXISTS "Users view allowed statuses" ON public.statuses;
CREATE POLICY "Users view allowed statuses" 
ON public.statuses FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.status_privacy sp
        WHERE sp.user_id = public.statuses.user_id
        AND (
            sp.visibility = 'everyone'
            OR (sp.visibility = 'contacts' AND EXISTS (
                SELECT 1 FROM public.chat_members cm1
                JOIN public.chat_members cm2 ON cm1.chat_id = cm2.chat_id
                WHERE cm1.user_id = auth.uid() AND cm2.user_id = public.statuses.user_id
            ))
            OR (sp.visibility = 'selected' AND EXISTS (
                SELECT 1 FROM public.status_allowed_users sau
                WHERE sau.status_owner_id = public.statuses.user_id AND sau.allowed_user_id = auth.uid()
            ))
        )
    )
    AND expires_at > NOW()
);

-- 5. Ensure the 'media' bucket is public and allows public viewing
-- Note: This assumes you have a bucket named 'media'.
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies for 'media' bucket
-- Allow anyone to view media (required for Statuses and Chat images)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
