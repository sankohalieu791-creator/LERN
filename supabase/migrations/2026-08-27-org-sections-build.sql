-- Org sections build: Review (student history context) + Briefs "upload
-- existing work" (staff submitting on a student's behalf).
-- Run in the Supabase SQL Editor, then verify via REST as usual.

-- ── Reviews: widen read access to any of the submission's own org staff ──
-- Previously a reviewer could only see reviews they personally wrote (plus
-- their own submissions, plus the safeguarding lead saw everything). The
-- Review screen spec asks to show "the student's past review history for
-- context" to whichever tutor is reviewing next -- not just the safeguarding
-- lead or the original reviewer. Reviews are still append-only (no UPDATE/
-- DELETE policy exists, unaffected by this) and still never visible to a
-- different organisation or to employers.
DROP POLICY IF EXISTS "reviews: student, reviewer, or safeguarding lead read" ON public.reviews;
CREATE POLICY "reviews: student, org staff, or safeguarding lead read" ON public.reviews FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );

-- ── Submissions: org staff can submit existing/already-marked work on a
-- student's behalf ("Upload existing work" in Briefs) ──
-- This is additive (OR'd with the existing student-self-insert policy) --
-- a student can still only ever submit their own work. Staff can only
-- attach a submission to a work_item in their own org, and only for a
-- student who is actually in that same org.
CREATE POLICY "submissions: org staff insert on behalf of student" ON public.submissions FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = student_id AND u.organisation_id = public.current_user_org() AND u.role = 'student'
    )
  );
