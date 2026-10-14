-- Fix: an employer couldn't see the NAME of someone who had directly
-- applied to one of their own job postings, if that candidate didn't
-- yet have any verified work. The existing employer-read policy on
-- public.users is gated on has_verification(id) (same rule Discover
-- uses), which makes sense for browsing Discover but wrongly also
-- blocked an employer from reading the basic profile of someone who
-- applied straight to their own opportunity or who they expressed
-- direct interest in -- the card just showed a "?" avatar with no
-- name at all (confirmed live: Priya Nair and Ruby Fairweather, both
-- with a live application but zero verified work yet, 14 Oct 2026).
--
-- This adds a second, narrower SELECT policy (Postgres combines
-- multiple permissive policies with OR, so this doesn't touch or
-- replace the existing verification-based one) granting an employer
-- read access to a student's row specifically when that student has a
-- live application or direct-interest record with that same employer.
-- Scoped to the employer's OWN applicants/interest only -- this is not
-- a Discover-wide visibility change.
CREATE POLICY "users: employer read linked candidates" ON public.users
  FOR SELECT
  USING (
    current_user_role() = 'employer'
    AND NOT current_user_is_guest()
    AND (
      EXISTS (
        SELECT 1 FROM public.applications
        WHERE applications.student_id = users.id
          AND applications.employer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.interest
        WHERE interest.student_id = users.id
          AND interest.employer_id = auth.uid()
      )
    )
  );

-- Same gap, one level up: "No verified item shows a reviewer... put
-- the verifier's role, institution and date on every verified item" --
-- the client code to show the reviewer's name now exists
-- (CandidateDetailPanel.tsx), but the verifier:users!...(full_name,
-- role) join it reads from still hits this same users RLS wall, so it
-- silently comes back null and every card falls back to a bare
-- "Verified · [date]" with no name attached (confirmed live, 14 Oct
-- 2026). Grants an employer read access to a staff member's basic
-- profile only when that staff member verified a piece of work the
-- employer is already otherwise entitled to see (same employer_visible/
-- public gate getVerifiedWorkForProfile already enforces) -- not a
-- blanket "employers can read all staff" grant.
CREATE POLICY "users: employer read verifiers of visible work" ON public.users
  FOR SELECT
  USING (
    current_user_role() = 'employer'
    AND NOT current_user_is_guest()
    AND EXISTS (
      SELECT 1 FROM public.verifications
      WHERE verifications.verified_by = users.id
        AND verifications.revoked_at IS NULL
        AND (verifications.visibility = 'public' OR verifications.employer_visible = true)
    )
  );
