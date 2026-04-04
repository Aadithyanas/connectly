-- Make the "media" bucket public if it exists
UPDATE storage.buckets SET public = true WHERE id = 'media';

-- If it doesn't exist, create it as public
INSERT INTO storage.buckets (id, name, public) 
SELECT 'media', 'media', true 
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'media');

-- Drop existing select policy to recreate it
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create policy to allow public reads for media
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
