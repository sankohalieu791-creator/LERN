-- ============================================================
-- Fix: infinite recursion in RLS, found by testing.
--
-- The "org-wide or public read by share visibility" policies on
-- submissions and verifications each did a subquery against the OTHER
-- table from inside their own USING clause. Evaluating a SELECT on
-- submissions requires evaluating all its policies, including the one
-- that queries verifications — which requires evaluating verifications'
-- policies, including the one that queries submissions — forever.
-- Postgres correctly detects this and errors: "infinite recursion
-- detected in policy for relation submissions".
--
-- Fix: move the whole check into one SECURITY DEFINER function that
-- reads both tables directly, bypassing RLS internally. Both policies
-- call the same function instead of querying each other's table
-- through a normal (RLS-checked) subquery, so there's no cycle left
-- to detect.
--
-- Run this after 2026-08-26-criteria-upload-safety-revoke.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submission_share_visible(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.verifications v
    JOIN public.submissions s ON s.id = v.submission_id
    WHERE v.submission_id = p_submission_id
      AND v.revoked_at IS NULL
      AND s.moderation_status = 'clear'
      AND (
        v.visibility = 'public'
        OR (v.visibility = 'organisation' AND EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = s.student_id AND u.organisation_id = public.current_user_org()
            ))
      )
  )
$$;

DROP POLICY IF EXISTS "verifications: org-wide or public read by share visibility" ON public.verifications;
CREATE POLICY "verifications: org-wide or public read by share visibility" ON public.verifications FOR SELECT
  USING (public.submission_share_visible(submission_id));

DROP POLICY IF EXISTS "submissions: org-wide or public read by share visibility" ON public.submissions;
CREATE POLICY "submissions: org-wide or public read by share visibility" ON public.submissions FOR SELECT
  USING (public.submission_share_visible(submissions.id));

-- Also make the moderation-gate trigger SECURITY DEFINER — it reads
-- submissions.moderation_status from inside a trigger on reviews, which
-- means that read is itself subject to submissions' full RLS (including
-- the policy above) unless it bypasses RLS the same way. Not currently
-- a recursion (reviews' own policies don't loop back), but leaving it
-- as a normal read subjects an internal check to the same class of
-- policy interaction that just caused the bug above — bypass it
-- properly rather than relying on it happening not to recurse today.
CREATE OR REPLACE FUNCTION public.check_moderation_before_verify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod TEXT;
BEGIN
  IF NEW.decision = 'verified' THEN
    SELECT moderation_status INTO v_mod FROM public.submissions WHERE id = NEW.submission_id;
    IF v_mod <> 'clear' THEN
      RAISE EXCEPTION 'Cannot verify a submission flagged for moderation review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
