ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title TEXT;

CREATE OR REPLACE FUNCTION public.increment_post_views(p_post_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = p_post_id
$$;
GRANT EXECUTE ON FUNCTION public.increment_post_views(UUID) TO authenticated;

-- Appended at the very end of the SELECT list -- CREATE OR REPLACE VIEW
-- can only append columns, never insert into the middle (learned that
-- one the hard way already on this view).
CREATE OR REPLACE VIEW public.posts_feed AS
SELECT
  p.id, p.organisation_id, p.author_id, p.content, p.image_path, p.visibility, p.hidden, p.created_at,
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
  u.role AS author_role,
  p.video_path,
  p.views_count,
  p.category,
  p.title
FROM public.posts p
JOIN public.users u ON u.id = p.author_id
LEFT JOIN public.organisations o ON o.id = p.organisation_id;

ALTER VIEW public.posts_feed SET (security_invoker = true);
GRANT SELECT ON public.posts_feed TO authenticated;
