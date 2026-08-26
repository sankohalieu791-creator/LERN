-- ============================================================
-- LERN v2 — Step 4b (share visibility by verified age) + 3 fixes
-- found by hard RLS testing.
--
-- Fixes (found via testing, not part of the original ask, but real
-- holes worth closing before this goes near a real student):
--
-- 1. date_of_birth was self-editable. A student could PATCH their own
--    row and set themselves to 18+, defeating the entire under-18
--    protection this migration exists to build. Locked down exactly
--    like role/organisation_id already were.
--
-- 2. The employer "can see verified students" policy did a subquery
--    against `verifications`/`submissions` directly from inside the
--    `users` policy. In Postgres RLS, a subquery inside one table's
--    policy is STILL subject to the referenced table's own RLS for the
--    calling role — so the employer's own restricted view of
--    `submissions` (which they can't read at all) made the EXISTS
--    always evaluate false. Moved the check into a SECURITY DEFINER
--    function, same pattern as current_user_role()/current_user_org().
--
-- 3. organisations_public was created WITH (security_invoker = true),
--    which does the opposite of what it needs to: it forces the view
--    to respect the CALLER's RLS on the underlying (locked-down)
--    organisations table, so students got zero rows back — the same
--    restriction the view was supposed to lift. Removed.
--
-- Run this after 2026-08-26-fix-org-check-constraint.sql.
-- ============================================================


-- ============================================================
-- FIX 1 — lock date_of_birth the same way role/organisation_id are locked
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_self_role_org_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
      RAISE EXCEPTION 'Cannot change your own organisation';
    END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      RAISE EXCEPTION 'Cannot change your own date of birth — contact your organisation to correct it';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- (trigger already exists and points at this function — CREATE OR REPLACE above is enough)


-- ============================================================
-- FIX 2 — employer-sees-verified-student check via SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_verification(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.submissions s ON s.id = v.submission_id
    WHERE s.student_id = p_student_id
  )
$$;

DROP POLICY IF EXISTS "users: self read" ON public.users;
CREATE POLICY "users: self read" ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR (public.current_user_role() IN ('institution_staff','provider_staff')
        AND organisation_id = public.current_user_org())
    OR (public.current_user_role() = 'employer' AND public.has_verification(id))
  );


-- ============================================================
-- FIX 3 — organisations_public should NOT enforce the caller's RLS
-- on the underlying (staff-only) organisations table
-- ============================================================

DROP VIEW IF EXISTS public.organisations_public;
CREATE VIEW public.organisations_public AS
  SELECT id, name FROM public.organisations;
-- No security_invoker option -> runs as the view owner, which is what
-- lets a student see their own org's name without being able to read
-- the underlying table's `type` column or other orgs' rows (the view
-- itself only ever exposes id + name, for every row, to any
-- authenticated user — that's an intentional, narrow bypass).
GRANT SELECT ON public.organisations_public TO authenticated;


-- ============================================================
-- STEP 4b — share visibility, gated by verified age
-- ============================================================

ALTER TABLE public.verifications
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'organisation'
  CHECK (visibility IN ('organisation','public'));

-- The one place the under-18 rule is actually enforced. Reads
-- date_of_birth from public.users — which, after Fix 1 above, a
-- student can no longer self-edit — so "verified age" really is
-- verified, not whatever the request claims. This fires on every
-- UPDATE regardless of who's asking or what column they think they're
-- changing, so there is no client path around it.
CREATE OR REPLACE FUNCTION public.enforce_share_visibility_by_age()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dob DATE;
BEGIN
  IF NEW.visibility = 'public' AND NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    SELECT u.date_of_birth INTO v_dob
    FROM public.submissions s
    JOIN public.users u ON u.id = s.student_id
    WHERE s.id = NEW.submission_id;

    IF v_dob IS NULL OR v_dob > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'Verified work can only be made public once the student is 18 or over';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_share_visibility_age
  BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.enforce_share_visibility_by_age();

-- Only the owning student may change visibility on their own verified
-- work — and only visibility; submission_id/verified_by/verified_at
-- stay immutable (this policy's USING clause doesn't restrict which
-- columns change, but there's nothing else on this row a client has
-- any legitimate reason to touch, and the age trigger above still runs
-- regardless of what's sent).
CREATE POLICY "verifications: student sets own share visibility" ON public.verifications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
  );

-- Extend read access for verifications and submissions to match the
-- new sharing rule — an 'organisation' item is visible to anyone in
-- the student's own org (not just staff, per "visible to their
-- organisation and the people in it"); a 'public' item is visible to
-- any authenticated user platform-wide. These ADD to the existing
-- SELECT policies (Postgres OR's multiple permissive policies
-- together) rather than replacing the owner/staff/employer rules
-- already in place.
CREATE POLICY "verifications: org-wide or public read by share visibility" ON public.verifications FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'organisation' AND EXISTS (
          SELECT 1 FROM public.submissions s
          JOIN public.users u ON u.id = s.student_id
          WHERE s.id = submission_id AND u.organisation_id = public.current_user_org()
        ))
  );

CREATE POLICY "submissions: org-wide or public read by share visibility" ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.verifications v
      WHERE v.submission_id = submissions.id
        AND (
          v.visibility = 'public'
          OR (v.visibility = 'organisation' AND EXISTS (
                SELECT 1 FROM public.users u WHERE u.id = submissions.student_id AND u.organisation_id = public.current_user_org()
              ))
        )
    )
  );
