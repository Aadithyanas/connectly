-- Instagram-style Carousel Migration (Rerun-Safe)
-- This script converts 'media_url' and 'media_type' to Arrays (TEXT[])
-- and handles existing data safely even if run multiple times.

BEGIN;

-- 1. Safely rename existing columns ONLY if they still exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='media_url') THEN
        ALTER TABLE public.posts RENAME COLUMN media_url TO old_media_url;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='media_type') THEN
        ALTER TABLE public.posts RENAME COLUMN media_type TO old_media_type;
    END IF;
END $$;

-- 2. Add new Array columns if they don't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_types TEXT[] DEFAULT '{}';

-- 3. Migrate existing data if old columns exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='old_media_url') THEN
        UPDATE public.posts 
        SET media_urls = ARRAY[old_media_url],
            media_types = ARRAY[old_media_type]
        WHERE old_media_url IS NOT NULL AND (media_urls = '{}' OR media_urls IS NULL);
        
        -- 4. Clean up the old columns
        ALTER TABLE public.posts DROP COLUMN old_media_url;
        ALTER TABLE public.posts DROP COLUMN old_media_type;
    END IF;
END $$;

COMMIT;

-- 5. Safe Realtime Verification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'posts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add to publication: %', SQLERRM;
END $$;
