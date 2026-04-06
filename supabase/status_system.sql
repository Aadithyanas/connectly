-- 1. Table for User Statuses (Stories)
CREATE TABLE IF NOT EXISTS public.statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_url TEXT NOT NULL,
    content_type TEXT DEFAULT 'image', -- 'image' or 'video'
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 2. Table for Status Privacy Settings
CREATE TABLE IF NOT EXISTS public.status_privacy (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    visibility TEXT DEFAULT 'everyone', -- 'everyone', 'contacts', 'selected'
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for Specific Allowed Users (for 'selected' visibility)
CREATE TABLE IF NOT EXISTS public.status_allowed_users (
    status_owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    allowed_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (status_owner_id, allowed_user_id)
);

-- Enable RLS
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_allowed_users ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR STATUSES

-- 4.1. Users can always see their own statuses
CREATE POLICY "Users can always see their own statuses" 
ON public.statuses FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4.2. COMPLEX VISIBILITY POLICY
-- Users can see statuses if:
--   a) Visibility is 'everyone'
--   b) Visibility is 'contacts' AND they have a mutual chat
--   c) Visibility is 'selected' AND they are in the allowed list
CREATE POLICY "Users view allowed statuses" 
ON public.statuses FOR SELECT TO authenticated
USING (
    user_id IN (
        -- Visibility is 'everyone'
        SELECT s_p.user_id FROM public.status_privacy s_p 
        WHERE s_p.user_id = public.statuses.user_id AND s_p.visibility = 'everyone'
        
        UNION
        
        -- Visibility is 'contacts' (Has chat history)
        SELECT s_p.user_id FROM public.status_privacy s_p 
        WHERE s_p.user_id = public.statuses.user_id AND s_p.visibility = 'contacts'
        AND EXISTS (
            SELECT 1 FROM public.chat_members cm1
            JOIN public.chat_members cm2 ON cm1.chat_id = cm2.chat_id
            WHERE cm1.user_id = auth.uid() AND cm2.user_id = public.statuses.user_id
        )
        
        UNION
        
        -- Visibility is 'selected'
        SELECT s_p.user_id FROM public.status_privacy s_p 
        WHERE s_p.user_id = public.statuses.user_id AND s_p.visibility = 'selected'
        AND EXISTS (
             SELECT 1 FROM public.status_allowed_users s_a_u
             WHERE s_a_u.status_owner_id = public.statuses.user_id AND s_a_u.allowed_user_id = auth.uid()
        )
    )
    -- Important: Exclude expired statuses
    AND expires_at > NOW()
);

-- 4.3. Users can manage their own privacy
CREATE POLICY "Users can manage their own privacy" 
ON public.status_privacy FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4.4. Users can manage their allowed list
CREATE POLICY "Users can manage their allowed list" 
ON public.status_allowed_users FOR ALL TO authenticated USING (auth.uid() = status_owner_id);

-- 5. TRIGGER: Auto-create privacy row for new users
CREATE OR REPLACE FUNCTION public.handle_new_status_privacy()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.status_privacy (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_privacy
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_status_privacy();
