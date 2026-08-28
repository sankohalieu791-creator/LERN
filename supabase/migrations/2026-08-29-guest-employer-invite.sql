-- ============================================================
-- Type 1 employer: guest invite (build order item 1 of the
-- "Employer side (two types) + connections" spec).
--
-- A guest employer is invited by ONE organisation to see ONE
-- specific student, or ONE specific piece of verified work — never
-- the wider platform. They still get a real auth.users/public.users
-- row (role stays 'employer'; the RLS model everywhere else already
-- keys off that), but:
--   1. Account creation skips the founder allowlist ONLY when a
--      valid, unclaimed, unrevoked guest_invites row backs it up —
--      never just because a client claims a guest_invite_id in
--      metadata. Role/is_guest are FORCED server-side on that path,
--      not read from client-supplied metadata, so a guest link can
--      never be used to self-elevate into staff/student.
--   2. Every place an independent employer can browse broadly
--      (verifications/submissions/work_items) is tightened to
--      exclude is_guest, and a narrow new policy grants a guest read
--      access to exactly what's been shared with them — nothing else.
--   3. Guests can never post (opportunities, briefs) — role='employer'
--      already blocks briefs (staff-only insert); opportunities is
--      tightened here explicitly.
--
-- Run in the Supabase SQL Editor.
-- ============================================================

-- ── Guest invite + what's shared on it ──────────────────────
CREATE TABLE public.guest_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  token            TEXT NOT NULL UNIQUE,
  created_by       UUID REFERENCES public.users(id),
  claimed_by       UUID REFERENCES public.users(id),
  claimed_at       TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_invites_token ON public.guest_invites(token);
CREATE INDEX idx_guest_invites_org ON public.guest_invites(organisation_id);

-- One row per shared thing. Sharing a student (student_id set) means
-- "everything this student has verified, dynamically" — new work they
-- verify later is visible too. Sharing a single verification_id means
-- just that one piece of work, nothing else about the student.
CREATE TABLE public.guest_invite_shares (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id        UUID NOT NULL REFERENCES public.guest_invites(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  verification_id  UUID REFERENCES public.verifications(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((student_id IS NOT NULL) <> (verification_id IS NOT NULL))
);
CREATE INDEX idx_guest_shares_invite ON public.guest_invite_shares(invite_id);

ALTER TABLE public.users ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN guest_invite_id UUID REFERENCES public.guest_invites(id);

-- ── Helper functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_is_guest()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_guest, false) FROM public.users WHERE id = auth.uid()
$$;

-- Does the calling guest have a live share covering this student
-- (directly, or via a specific verification of theirs)?
CREATE OR REPLACE FUNCTION public.guest_can_see_student(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guest_invites gi
    JOIN public.guest_invite_shares gis ON gis.invite_id = gi.id
    WHERE gi.claimed_by = auth.uid() AND gi.revoked_at IS NULL
      AND (
        gis.student_id = p_student_id
        OR gis.verification_id IN (
          SELECT v.id FROM public.verifications v
          JOIN public.submissions s ON s.id = v.submission_id
          WHERE s.student_id = p_student_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.guest_can_see_verification(p_verification_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guest_invites gi
    JOIN public.guest_invite_shares gis ON gis.invite_id = gi.id
    WHERE gi.claimed_by = auth.uid() AND gi.revoked_at IS NULL
      AND (
        gis.verification_id = p_verification_id
        OR gis.student_id = (
          SELECT s.student_id FROM public.verifications v2
          JOIN public.submissions s ON s.id = v2.submission_id
          WHERE v2.id = p_verification_id
        )
      )
  )
$$;

-- ── handle_new_user(): guest bypass, forced role, atomic claim ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guest_invite_id UUID;
BEGIN
  -- Only trust guest_invite_id if it points at a real, still-claimable
  -- invite -- a client can put anything in signUp() metadata, so the
  -- allowlist bypass below depends on this check, never on the
  -- metadata's mere presence.
  SELECT id INTO v_guest_invite_id
  FROM public.guest_invites
  WHERE id = NULLIF(NEW.raw_user_meta_data->>'guest_invite_id', '')::UUID
    AND revoked_at IS NULL
    AND claimed_by IS NULL;

  IF NOT public.is_allowlisted_email(NEW.email) AND v_guest_invite_id IS NULL THEN
    RAISE EXCEPTION 'LERN is still being built and is not open yet.';
  END IF;

  INSERT INTO public.users (id, role, full_name, email, date_of_birth, organisation_id, is_guest, guest_invite_id)
  VALUES (
    NEW.id,
    CASE WHEN v_guest_invite_id IS NOT NULL THEN 'employer' ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'student') END,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::DATE,
    NULLIF(NEW.raw_user_meta_data->>'organisation_id', '')::UUID,
    v_guest_invite_id IS NOT NULL,
    v_guest_invite_id
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_guest_invite_id IS NOT NULL THEN
    UPDATE public.guest_invites SET claimed_by = NEW.id, claimed_at = now()
    WHERE id = v_guest_invite_id AND claimed_by IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
-- (trigger on_auth_user_created already points at this function)

-- ── RLS: guest_invites / guest_invite_shares ─────────────────
ALTER TABLE public.guest_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_invite_shares ENABLE ROW LEVEL SECURITY;

-- Org staff manage their own org's invites. A claiming guest reads
-- their OWN invite row too (so the app can show "invited by X").
CREATE POLICY "guest_invites: org staff read" ON public.guest_invites FOR SELECT
  USING (
    (public.current_user_role() IN ('institution_staff','provider_staff') AND organisation_id = public.current_user_org())
    OR claimed_by = auth.uid()
  );
CREATE POLICY "guest_invites: org staff insert" ON public.guest_invites FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
    AND created_by = auth.uid()
  );
CREATE POLICY "guest_invites: org staff revoke" ON public.guest_invites FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );

CREATE POLICY "guest_invite_shares: org staff read" ON public.guest_invite_shares FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.guest_invites gi WHERE gi.id = invite_id AND gi.organisation_id = public.current_user_org())
    AND public.current_user_role() IN ('institution_staff','provider_staff')
  );
CREATE POLICY "guest_invite_shares: org staff insert" ON public.guest_invite_shares FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.guest_invites gi WHERE gi.id = invite_id AND gi.organisation_id = public.current_user_org() AND gi.created_by = auth.uid())
    AND public.current_user_role() IN ('institution_staff','provider_staff')
  );

-- ── Tighten the existing independent-employer read policies to
-- exclude guests, and add narrow guest-scoped read policies ──
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
    OR (public.current_user_role() = 'employer' AND NOT public.current_user_is_guest() AND visibility = 'public')
    OR (public.current_user_is_guest() AND public.guest_can_see_verification(id))
  );

DROP POLICY IF EXISTS "submissions: employer read via public verification" ON public.submissions;
CREATE POLICY "submissions: employer read via public verification" ON public.submissions FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND EXISTS (SELECT 1 FROM public.verifications v WHERE v.submission_id = id AND v.visibility = 'public')
  );
CREATE POLICY "submissions: guest read via share" ON public.submissions FOR SELECT
  USING (
    public.current_user_is_guest()
    AND EXISTS (SELECT 1 FROM public.verifications v WHERE v.submission_id = id AND public.guest_can_see_verification(v.id))
  );

DROP POLICY IF EXISTS "work_items: employer read via public verification" ON public.work_items;
CREATE POLICY "work_items: employer read via public verification" ON public.work_items FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.verifications v ON v.submission_id = s.id
      WHERE s.work_item_id = id AND v.visibility = 'public'
    )
  );
CREATE POLICY "work_items: guest read via share" ON public.work_items FOR SELECT
  USING (
    public.current_user_is_guest()
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.verifications v ON v.submission_id = s.id
      WHERE s.work_item_id = id AND public.guest_can_see_verification(v.id)
    )
  );

-- A guest can see the student's row on exactly the same "shared with
-- them" basis -- separate from has_verification() (public-only),
-- since shared work is often organisation-only visibility, not public.
CREATE POLICY "users: guest read shared student" ON public.users FOR SELECT
  USING (public.current_user_is_guest() AND public.guest_can_see_student(id));

-- ── Guests never post: tighten opportunities insert ──────────
DROP POLICY IF EXISTS "opportunities: employer self insert" ON public.opportunities;
CREATE POLICY "opportunities: employer self insert" ON public.opportunities FOR INSERT
  WITH CHECK (employer_id = auth.uid() AND public.current_user_role() = 'employer' AND NOT public.current_user_is_guest());

-- ── Interest: a guest may only express interest in a student
-- actually covered by one of their shares (independent employers are
-- unrestricted here, as before) ──
DROP POLICY IF EXISTS "interest: employer insert" ON public.interest;
CREATE POLICY "interest: employer insert" ON public.interest FOR INSERT
  WITH CHECK (
    employer_id = auth.uid() AND public.current_user_role() = 'employer'
    AND (NOT public.current_user_is_guest() OR public.guest_can_see_student(student_id))
  );
