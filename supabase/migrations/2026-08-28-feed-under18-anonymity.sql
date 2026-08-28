-- Safeguarding gap found while reviewing the Feed spec: "under-18s are
-- not publicly searchable or identifiable as people. Their content can
-- be seen, but a stranger cannot find, locate or build a profile on the
-- child." Posts were exposing the real author name to every viewer
-- regardless of age or org, including strangers viewing a public post
-- from outside the author's organisation.
--
-- Computed server-side (never exposes raw date_of_birth to the client)
-- via a view instead of client-side age math: within the author's own
-- org, staff/peers always see the real name (an already-safeguarded,
-- consented context, same principle as verified-work visibility
-- elsewhere in this schema). Outside it -- a public post seen by
-- someone in a different org, or no org at all -- an under-18 author
-- is shown as "{org name} student" instead of their name.
-- Run in the Supabase SQL Editor.

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
  u.role AS author_role
FROM public.posts p
JOIN public.users u ON u.id = p.author_id
LEFT JOIN public.organisations o ON o.id = p.organisation_id;

ALTER VIEW public.posts_feed SET (security_invoker = true);
GRANT SELECT ON public.posts_feed TO authenticated;
