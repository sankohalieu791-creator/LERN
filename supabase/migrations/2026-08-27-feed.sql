-- Feed: posts + a fixed set of positive reactions (no free-text comments
-- anywhere, per spec). Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  author_id       UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content         TEXT,
  image_path      TEXT,
  visibility      TEXT NOT NULL DEFAULT 'organisation' CHECK (visibility IN ('organisation','public')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_has_content CHECK (content IS NOT NULL OR image_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_posts_org ON public.posts(organisation_id, created_at DESC);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Same age-gated public-visibility rule as verified work: under-18s
-- can't post publicly across orgs, matching the existing share-visibility
-- protection (organisations.date_of_birth check via a trigger).
CREATE OR REPLACE FUNCTION public.check_post_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dob DATE;
BEGIN
  IF NEW.visibility = 'public' THEN
    SELECT date_of_birth INTO v_dob FROM public.users WHERE id = NEW.author_id;
    IF v_dob IS NULL OR (EXTRACT(YEAR FROM age(v_dob)) < 18) THEN
      RAISE EXCEPTION 'Only adults (18+) can post publicly — under-18 posts stay organisation-only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS posts_visibility_check ON public.posts;
CREATE TRIGGER posts_visibility_check BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_post_visibility();

DROP POLICY IF EXISTS "posts: org or public read" ON public.posts;
CREATE POLICY "posts: org or public read" ON public.posts FOR SELECT
  USING (visibility = 'public' OR organisation_id = public.current_user_org());
DROP POLICY IF EXISTS "posts: org staff/student insert own org" ON public.posts;
CREATE POLICY "posts: author insert own org" ON public.posts FOR INSERT
  WITH CHECK (author_id = auth.uid() AND organisation_id = public.current_user_org());
DROP POLICY IF EXISTS "posts: author delete" ON public.posts;
CREATE POLICY "posts: author or org staff delete" ON public.posts FOR DELETE
  USING (
    author_id = auth.uid()
    OR (public.current_user_role() IN ('institution_staff','provider_staff') AND organisation_id = public.current_user_org())
  );

-- ── Reactions: fixed positive set only, one per user per post ──
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reaction   TEXT NOT NULL CHECK (reaction IN ('congratulations','well_done','keep_going','thumbs_up','celebrate_lern')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_reactions: read if post visible" ON public.post_reactions;
CREATE POLICY "post_reactions: read if post visible" ON public.post_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = post_id
    AND (p.visibility = 'public' OR p.organisation_id = public.current_user_org())
  ));
DROP POLICY IF EXISTS "post_reactions: self insert if post visible" ON public.post_reactions;
CREATE POLICY "post_reactions: self insert if post visible" ON public.post_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = post_id
      AND (p.visibility = 'public' OR p.organisation_id = public.current_user_org())
    )
  );
DROP POLICY IF EXISTS "post_reactions: self update" ON public.post_reactions;
CREATE POLICY "post_reactions: self update" ON public.post_reactions FOR UPDATE
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "post_reactions: self delete" ON public.post_reactions;
CREATE POLICY "post_reactions: self delete" ON public.post_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ── Storage: post images ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', FALSE, 10485760, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "post-images: author upload own folder" ON storage.objects;
CREATE POLICY "post-images: author upload own folder" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "post-images: read if post visible" ON storage.objects;
CREATE POLICY "post-images: read if post visible" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'post-images'
    AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.image_path = storage.objects.name
      AND (p.visibility = 'public' OR p.organisation_id = public.current_user_org())
    )
  );
