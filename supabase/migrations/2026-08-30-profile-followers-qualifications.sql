CREATE TABLE IF NOT EXISTS public.followers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  followed_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS idx_followers_follower ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_followed ON public.followers(followed_id);
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Follow lists are visible to any authenticated user (same as any
-- social profile's follower count) -- nothing sensitive in a bare
-- follower/followed pair.
DROP POLICY IF EXISTS "followers: authenticated read" ON public.followers;
CREATE POLICY "followers: authenticated read" ON public.followers FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "followers: self insert" ON public.followers;
CREATE POLICY "followers: self insert" ON public.followers FOR INSERT
  WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS "followers: self delete" ON public.followers;
CREATE POLICY "followers: self delete" ON public.followers FOR DELETE
  USING (follower_id = auth.uid());

-- Self-added qualifications: deliberately a completely separate table
-- from verifications, never joined into the same query the green tick
-- comes from -- the whole point is these two can never be confused
-- with each other in the UI, and this keeps them structurally
-- impossible to blend server-side too.
CREATE TABLE IF NOT EXISTS public.self_qualifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  issuer      TEXT,
  file_path   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_self_quals_student ON public.self_qualifications(student_id);
ALTER TABLE public.self_qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_qualifications: authenticated read" ON public.self_qualifications;
CREATE POLICY "self_qualifications: authenticated read" ON public.self_qualifications FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "self_qualifications: owner insert" ON public.self_qualifications;
CREATE POLICY "self_qualifications: owner insert" ON public.self_qualifications FOR INSERT
  WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "self_qualifications: owner delete" ON public.self_qualifications;
CREATE POLICY "self_qualifications: owner delete" ON public.self_qualifications FOR DELETE
  USING (student_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('self-qualifications', 'self-qualifications', FALSE, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "self-qualifications: owner upload" ON storage.objects;
CREATE POLICY "self-qualifications: owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'self-qualifications' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "self-qualifications: authenticated read" ON storage.objects;
CREATE POLICY "self-qualifications: authenticated read" ON storage.objects FOR SELECT
  USING (bucket_id = 'self-qualifications' AND auth.uid() IS NOT NULL);
