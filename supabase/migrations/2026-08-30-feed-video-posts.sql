ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_has_content;
ALTER TABLE public.posts ADD CONSTRAINT posts_has_content
  CHECK (content IS NOT NULL OR image_path IS NOT NULL OR video_path IS NOT NULL);

CREATE OR REPLACE VIEW public.posts_feed AS
SELECT
  p.id, p.organisation_id, p.author_id, p.content, p.image_path, p.video_path, p.visibility, p.hidden, p.created_at,
  CASE
    WHEN p.organisation_id IS DISTINCT FROM public.current_user_org()
      AND (u.date_of_birth IS NULL OR EXTRACT(YEAR FROM age(u.date_of_birth)) < 18)
    THEN true
    ELSE false
  END AS author_anonymised,
  CASE
    WHEN p.organisation_id IS DISTINCT FROM public.current_user_org()
      AND (u.date_of_birth IS NULL OR EXTRACT(YEAR FROM age(u.date_of_birth)) < 18)
    THEN COALESCE(o.name, 'LERN') || ' student'
    ELSE u.full_name
  END AS author_name,
  u.role AS author_role
FROM public.posts p
JOIN public.users u ON u.id = p.author_id
LEFT JOIN public.organisations o ON o.id = p.organisation_id;

ALTER VIEW public.posts_feed SET (security_invoker = true);
GRANT SELECT ON public.posts_feed TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-videos', 'post-videos', FALSE, 104857600, ARRAY['video/webm','video/mp4'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "post-videos: author upload own folder" ON storage.objects;
CREATE POLICY "post-videos: author upload own folder" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "post-videos: read if post visible" ON storage.objects;
CREATE POLICY "post-videos: read if post visible" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'post-videos'
    AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.video_path = storage.objects.name
      AND (p.visibility = 'public' OR p.organisation_id = public.current_user_org())
    )
  );
