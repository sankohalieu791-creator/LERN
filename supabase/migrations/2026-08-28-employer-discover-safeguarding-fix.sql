-- ============================================================
-- Employer Discover — safeguarding fix + read policies
--
-- Found while building Discover: the existing employer policy on
-- `verifications` ("verifications: student or org staff read") grants
-- employers SELECT on every row with no visibility check at all —
-- it ignores the organisation/public split that Step 4b (share
-- visibility by verified age) exists to enforce. An employer could
-- currently read a student's verified work even when that student
-- (or, for a minor, the fact that they can never set 'public' at
-- all) never made it public. That directly contradicts "employers
-- only see what's been approved for public/employer view."
--
-- Separately, `submissions` and `work_items` had NO employer read
-- policy at all, so even the (over-broad) verifications access above
-- couldn't actually be joined into anything showable — Discover
-- would have had zero usable rows. This adds narrowly-scoped employer
-- read access to exactly the chain a public verification unlocks:
-- verification.visibility = 'public' -> its submission -> its work_item
-- -> the student's own public-readable fields (already covered by
-- has_verification() below, now tightened to match).
--
-- Run this after 2026-08-26-share-visibility-and-fixes.sql.
-- ============================================================

-- FIX — has_verification() now means "has a PUBLIC verification",
-- since its only caller ("users: self read") uses it to decide
-- whether an employer may see a student's row at all. Only one
-- call site (checked via grep before writing this), safe to retarget.
CREATE OR REPLACE FUNCTION public.has_verification(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.submissions s ON s.id = v.submission_id
    WHERE s.student_id = p_student_id AND v.visibility = 'public'
  )
$$;

-- FIX — narrow the employer branch of the verifications read policy
-- to public-visibility rows only. Multiple permissive SELECT policies
-- OR together in Postgres RLS, so this has to replace the policy
-- outright rather than add alongside it.
DROP POLICY IF EXISTS "verifications: student or org staff read" ON public.verifications;
CREATE POLICY "verifications: student or org staff read" ON public.verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
    OR (public.current_user_role() = 'employer' AND visibility = 'public')
  );

-- NEW — employer read on submissions, scoped to only the submission
-- behind a public verification (nothing else on this table is ever
-- employer-readable: no drafts, no organisation-only work).
DROP POLICY IF EXISTS "submissions: employer read via public verification" ON public.submissions;
CREATE POLICY "submissions: employer read via public verification" ON public.submissions FOR SELECT
  USING (
    public.current_user_role() = 'employer'
    AND EXISTS (SELECT 1 FROM public.verifications v WHERE v.submission_id = submissions.id AND v.visibility = 'public')
  );

-- NEW — employer read on work_items, scoped the same way (the brief/
-- course title behind a publicly-shared piece of verified work), on
-- top of the existing visibility = 'public' branch which covers a
-- different, org-controlled flag (whether staff listed the work item
-- itself publicly) — this is deliberately additive, not a replacement.
DROP POLICY IF EXISTS "work_items: employer read via public verification" ON public.work_items;
CREATE POLICY "work_items: employer read via public verification" ON public.work_items FOR SELECT
  USING (
    public.current_user_role() = 'employer'
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.verifications v ON v.submission_id = s.id
      WHERE s.work_item_id = work_items.id AND v.visibility = 'public'
    )
  );
