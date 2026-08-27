-- Access lock (founder-only, testing phase) + verified-email enforcement.
-- Both real backend enforcement, not just hidden in the UI: the allowlist
-- check runs inside the trigger that creates a user's public.users row, so
-- a non-allowlisted signup is rejected before any account exists at all --
-- there is no session, no row, nothing to route around.
-- Run in the Supabase SQL Editor.

-- ── 1. Access lock: allowlist enforced at account-creation time ──
CREATE OR REPLACE FUNCTION public.is_allowlisted_email(p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(p_email) IN (
    'sankohalieu791@gmail.com',
    'sankohaugusta9@gmail.com',
    'mohalieu58@gmail.com',
    'alieu@joinirl.co.uk'
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- LERN is closed to everyone except the founder allowlist while it's
  -- being tested. Raising here aborts the whole transaction, including
  -- the auth.users insert itself -- signUp() fails outright, no account,
  -- no session, nothing left over to clean up. Remove this block (and
  -- only this block) when the app is ready to open up.
  IF NOT public.is_allowlisted_email(NEW.email) THEN
    RAISE EXCEPTION 'LERN is still being built and is not open yet.';
  END IF;

  INSERT INTO public.users (id, role, full_name, email, date_of_birth, organisation_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::DATE,
    NULLIF(NEW.raw_user_meta_data->>'organisation_id', '')::UUID
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
-- (trigger on_auth_user_created already points at this function)

-- ── 2. Verified email: "do not allow unverified accounts to act" ──
-- Also turn on Authentication → Providers → Email → "Confirm email" in
-- the Supabase dashboard -- that's what makes signUp() actually send the
-- confirmation link and withhold a usable session until it's clicked.
-- This migration is the backend backstop regardless of that toggle: even
-- if a session exists pre-confirmation, the actions that matter are
-- blocked here.
CREATE OR REPLACE FUNCTION public.current_user_email_confirmed()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = auth.uid()
$$;

-- Submitting work, posting to the feed, and making a review decision are
-- the "act on the platform" verbs the spec calls out by name.
DROP POLICY IF EXISTS "submissions: student self insert" ON public.submissions;
CREATE POLICY "submissions: student self insert" ON public.submissions FOR INSERT
  WITH CHECK (student_id = auth.uid() AND public.current_user_email_confirmed());

DROP POLICY IF EXISTS "submissions: org staff insert on behalf of student" ON public.submissions;
CREATE POLICY "submissions: org staff insert on behalf of student" ON public.submissions FOR INSERT
  WITH CHECK (
    public.current_user_email_confirmed()
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = student_id AND u.organisation_id = public.current_user_org() AND u.role = 'student'
    )
  );

DROP POLICY IF EXISTS "posts: author insert own org" ON public.posts;
CREATE POLICY "posts: author insert own org" ON public.posts FOR INSERT
  WITH CHECK (author_id = auth.uid() AND organisation_id = public.current_user_org() AND public.current_user_email_confirmed());

-- reviews stays append-only; same guard added to its existing insert policy
DROP POLICY IF EXISTS "reviews: org staff insert" ON public.reviews;
CREATE POLICY "reviews: org staff insert" ON public.reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.current_user_email_confirmed()
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
    )
  );
