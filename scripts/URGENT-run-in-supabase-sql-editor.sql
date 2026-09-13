-- ============================================================
-- URGENT: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run. My own DB access (MCP) has been
-- disconnected from this session and I cannot run this for you
-- directly. This fixes the most severe finding from Michael's
-- Sep-10 review.
-- ============================================================

-- 1) posts_feed: the actual bug behind "guest link opens the full
--    feed", and broader than that -- ANY authenticated account of
--    ANY role could read EVERY organisation's non-hidden posts,
--    independent of visibility, because the old WHERE clause's bare
--    "p.hidden = false" was true for nearly every row regardless of
--    who was asking or what org it belonged to. Employers already
--    had Feed removed from their nav/routes on the app side; this is
--    the actual data-layer fix underneath that.
CREATE OR REPLACE VIEW public.posts_feed AS
SELECT p.id,
    p.organisation_id,
    p.author_id,
    p.content,
    p.image_path,
    p.visibility,
    p.hidden,
    p.created_at,
    CASE
        WHEN p.organisation_id IS DISTINCT FROM current_user_org() AND (u.date_of_birth IS NULL OR EXTRACT(year FROM age(u.date_of_birth::timestamp with time zone)) < 18::numeric) THEN true
        ELSE false
    END AS author_anonymised,
    CASE
        WHEN p.organisation_id IS DISTINCT FROM current_user_org() AND (u.date_of_birth IS NULL OR EXTRACT(year FROM age(u.date_of_birth::timestamp with time zone)) < 18::numeric) THEN COALESCE(o.name, 'LERN'::text) || ' student'::text
        ELSE u.full_name
    END AS author_name,
    u.role AS author_role,
    p.video_path,
    p.views_count,
    p.category,
    p.title,
    p.sticker_choices,
    CASE
        WHEN p.organisation_id IS DISTINCT FROM current_user_org() AND (u.date_of_birth IS NULL OR EXTRACT(year FROM age(u.date_of_birth::timestamp with time zone)) < 18::numeric) THEN NULL
        ELSE u.avatar_path
    END AS author_avatar_path
   FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN organisations o ON o.id = p.organisation_id
  WHERE p.author_id = auth.uid()
     OR (current_user_role() = ANY (ARRAY['institution_staff'::text, 'provider_staff'::text]) AND p.organisation_id = current_user_org())
     OR (current_user_role() = 'student'::text AND p.hidden = false AND p.organisation_id = current_user_org());

-- 2) A student viewing another student's profile (e.g. tapping a name
--    in Feed) needs to actually be able to read that person's row --
--    there was no policy for "same-org student reads another same-org
--    student" at all, only self/org-staff/employer-with-verification.
--    Row-level only: the client (getPublicStudentProfile in
--    lib/supabase.ts) selects a narrow, explicit column list for this
--    case (name/avatar/bio/tags), never email or date_of_birth, so
--    opening row access here doesn't also open those columns.
CREATE POLICY "users: same org student read" ON public.users
FOR SELECT USING (
  current_user_role() = 'student'
  AND organisation_id = current_user_org()
);

-- Avatars-bucket-to-private is intentionally NOT in this file. Every
-- avatar image in the app currently renders via a PUBLIC url
-- (getAvatarUrl -> .getPublicUrl()), called synchronously in ~30
-- places. Flipping the bucket to private before that client code is
-- converted to signed URLs would break every profile photo in the app
-- immediately. That's the next piece of work, shipped together with
-- its own SQL once the code side is ready -- do not flip
-- storage.buckets.public for 'avatars' before then.
