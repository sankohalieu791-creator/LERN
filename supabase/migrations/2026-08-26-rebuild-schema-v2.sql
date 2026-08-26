-- ============================================================
-- LERN v2 REBUILD — full schema replacement
--
-- Implements the blueprint: 4 roles (student, institution_staff,
-- provider_staff, employer), organisations, join codes, work items,
-- submissions, append-only reviews, verifications, and employer
-- opportunities/interest — with RLS as the real safeguarding boundary.
--
-- DESTRUCTIVE: drops every table from the old (v1) schema first.
-- All existing videos/courses/messages/organisations/job posts/
-- accounts data is permanently lost. Existing Supabase Auth logins
-- (auth.users) are left intact, but will have no matching profile
-- row until they go through the new signup/join flow — by design,
-- since the old profile shape (account_type, followers_count, etc.)
-- has no equivalent in the new model.
--
-- Run this once, in full, in the Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- PART 0 — Drop the old (v1) schema entirely
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS
  public.push_subscriptions,
  public.notifications,
  public.feedback,
  public.certificates,
  public.project_submissions,
  public.course_projects,
  public.projects,
  public.comments,
  public.video_likes,
  public.followers,
  public.workshop_enrollments,
  public.enrollments,
  public.course_sessions,
  public.courses,
  public.workshops,
  public.videos,
  public.saved_jobs,
  public.jobs,
  public.job_listings,
  public.interest,
  public.opportunities,
  public.training_requests,
  public.messages,
  public.conversations,
  public.profile_views,
  public.organisation_members,
  public.instructor_applications,
  public.course_ratings,
  public.users,
  public.organisations
CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.increment_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_like() CASCADE;
DROP FUNCTION IF EXISTS public.increment_comments_count() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_comments_count() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_comment() CASCADE;
DROP FUNCTION IF EXISTS public.increment_follower_counts() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_follower_counts() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_follow() CASCADE;
DROP FUNCTION IF EXISTS public.update_course_enrolled_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_workshop_enrolled_count() CASCADE;
DROP FUNCTION IF EXISTS public.handle_instructor_approval() CASCADE;
DROP FUNCTION IF EXISTS public.increment_video_views(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.increment_profile_views(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_notifications_read(uuid) CASCADE;


-- ============================================================
-- PART 1 — Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ── ORGANISATIONS ────────────────────────────────────────────
-- safeguarding_lead_id -> users(id) is added after users exists (circular FK).
CREATE TABLE public.organisations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('institution','provider')),
  safeguarding_lead_id  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── USERS ────────────────────────────────────────────────────
-- role is set at signup and is not self-changeable afterwards (see the
-- trigger at the end of Part 1) — it's the whole basis of the access
-- rules, so letting a row silently reassign its own role would be a
-- privilege-escalation hole.
CREATE TABLE public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('student','institution_staff','provider_staff','employer')),
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  date_of_birth    DATE,
  organisation_id  UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role = 'employer' OR organisation_id IS NOT NULL)  -- everyone except employers must belong to an org
);

ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_safeguarding_lead_fk
  FOREIGN KEY (safeguarding_lead_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ── JOIN CODES ───────────────────────────────────────────────
CREATE TABLE public.join_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  code             TEXT NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ,
  revoked          BOOLEAN NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── WORK ITEMS (briefs / courses / workshops) ───────────────
CREATE TABLE public.work_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('brief','course','workshop')),
  title            TEXT NOT NULL,
  description      TEXT,
  visibility       TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ENROLMENTS ───────────────────────────────────────────────
CREATE TABLE public.enrolments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_item_id   UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, work_item_id)
);

-- ── SUBMISSIONS ──────────────────────────────────────────────
CREATE TABLE public.submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_item_id   UUID NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  content        TEXT,
  status         TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','returned','verified')),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── REVIEWS (append-only safeguarding log) ──────────────────
-- No UPDATE or DELETE policy is defined anywhere below, by design —
-- under RLS, an operation with no matching policy is denied outright,
-- which is exactly "append-only" enforced by the database itself.
CREATE TABLE public.reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  reviewer_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  feedback       TEXT,
  decision       TEXT NOT NULL CHECK (decision IN ('verified','returned')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── VERIFICATIONS ────────────────────────────────────────────
CREATE TABLE public.verifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  verified_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  verified_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── OPPORTUNITIES ────────────────────────────────────────────
CREATE TABLE public.opportunities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INTEREST ─────────────────────────────────────────────────
-- Routed through the organisation for under-18s — org_notified_at is
-- set the moment interest is raised, before the student ever sees it.
CREATE TABLE public.interest (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  org_notified_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- PART 2 — Indexes
-- ============================================================

CREATE INDEX idx_users_organisation_id       ON public.users(organisation_id);
CREATE INDEX idx_users_role                  ON public.users(role);
CREATE INDEX idx_join_codes_organisation_id  ON public.join_codes(organisation_id);
CREATE INDEX idx_join_codes_code             ON public.join_codes(code);
CREATE INDEX idx_work_items_organisation_id  ON public.work_items(organisation_id);
CREATE INDEX idx_enrolments_student_id       ON public.enrolments(student_id);
CREATE INDEX idx_enrolments_work_item_id     ON public.enrolments(work_item_id);
CREATE INDEX idx_submissions_student_id      ON public.submissions(student_id);
CREATE INDEX idx_submissions_work_item_id    ON public.submissions(work_item_id);
CREATE INDEX idx_reviews_submission_id       ON public.reviews(submission_id);
CREATE INDEX idx_reviews_reviewer_id         ON public.reviews(reviewer_id);
CREATE INDEX idx_verifications_submission_id ON public.verifications(submission_id);
CREATE INDEX idx_opportunities_employer_id   ON public.opportunities(employer_id);
CREATE INDEX idx_interest_employer_id        ON public.interest(employer_id);
CREATE INDEX idx_interest_student_id         ON public.interest(student_id);


-- ============================================================
-- PART 3 — Helper functions (avoid RLS self-recursion on users)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organisation_id FROM public.users WHERE id = auth.uid()
$$;

-- Is auth.uid() the safeguarding lead of the given organisation?
CREATE OR REPLACE FUNCTION public.is_safeguarding_lead(p_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = p_org AND safeguarding_lead_id = auth.uid()
  )
$$;


-- ============================================================
-- PART 4 — Signup trigger + role/org tamper guard
-- ============================================================

-- Auto-create the profile row on signup. role/full_name/organisation_id
-- come from auth signup metadata (set by the client's signUp() call) —
-- the join-code flow resolves organisation_id via redeem_join_code()
-- below, either before signup (student picks org first) or right after.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- A user can update their own row (name, DOB correction, etc.) but never
-- their own role or organisation_id — that would be self-service privilege
-- escalation on the exact fields the whole access model is built on.
-- Org staff moving a student between orgs, or promoting a role, must go
-- through a service-role/admin path, not a client-side UPDATE.
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_self_role_org_change
  BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_org_change();

-- Redeem a join code during/after signup — SECURITY DEFINER so a
-- pre-org user (who owns no rows yet under normal RLS) can still look
-- up a code and get placed in the right organisation, without needing
-- a public SELECT policy on join_codes that would let anyone enumerate
-- every organisation's codes.
CREATE OR REPLACE FUNCTION public.redeem_join_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organisation_id INTO v_org
  FROM public.join_codes
  WHERE code = p_code
    AND revoked = FALSE
    AND (expires_at IS NULL OR expires_at > now());

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired join code';
  END IF;

  UPDATE public.users SET organisation_id = v_org WHERE id = auth.uid();
  RETURN v_org;
END;
$$;


-- ============================================================
-- PART 5 — Row Level Security
-- ============================================================

ALTER TABLE public.organisations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrolments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest       ENABLE ROW LEVEL SECURITY;

-- ── ORGANISATIONS ────────────────────────────────────────────
-- Full row (including `type`) is visible only to that org's own staff
-- and its safeguarding lead — "the org type is... never shown to
-- students" means students must not read this table directly at all.
-- Student-facing surfaces (e.g. "which org am I in") should query the
-- organisations_public view below instead.
CREATE POLICY "organisations: staff of own org read" ON public.organisations FOR SELECT
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND id = public.current_user_org()
  );
CREATE POLICY "organisations: safeguarding lead read" ON public.organisations FOR SELECT
  USING (safeguarding_lead_id = auth.uid());
-- Creation/edits happen via service role (org onboarding is an admin
-- action, not self-serve) — intentionally no INSERT/UPDATE policy yet.

-- Student- and employer-safe view: name only, never `type`.
CREATE OR REPLACE VIEW public.organisations_public
WITH (security_invoker = true) AS
  SELECT id, name FROM public.organisations;

-- ── USERS ────────────────────────────────────────────────────
CREATE POLICY "users: self read" ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR (public.current_user_role() IN ('institution_staff','provider_staff')
        AND organisation_id = public.current_user_org())
    OR (public.current_user_role() = 'employer' AND EXISTS (
          SELECT 1 FROM public.verifications v
          JOIN public.submissions s ON s.id = v.submission_id
          WHERE s.student_id = users.id
        ))
  );
CREATE POLICY "users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users: update own" ON public.users FOR UPDATE USING (auth.uid() = id);
-- No DELETE policy — account deletion goes through a service-role/admin path.

-- ── JOIN CODES ───────────────────────────────────────────────
-- Only an org's own staff can list/manage its codes. Redemption by a
-- not-yet-placed signee goes through redeem_join_code() above, not a
-- direct SELECT here.
CREATE POLICY "join_codes: org staff read" ON public.join_codes FOR SELECT
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );
CREATE POLICY "join_codes: org staff insert" ON public.join_codes FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );
CREATE POLICY "join_codes: org staff update" ON public.join_codes FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );

-- ── WORK ITEMS ───────────────────────────────────────────────
CREATE POLICY "work_items: org member read" ON public.work_items FOR SELECT
  USING (
    visibility = 'public'
    OR organisation_id = public.current_user_org()
  );
CREATE POLICY "work_items: staff insert" ON public.work_items FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );
CREATE POLICY "work_items: staff update" ON public.work_items FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );
CREATE POLICY "work_items: staff delete" ON public.work_items FOR DELETE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = public.current_user_org()
  );

-- ── ENROLMENTS ───────────────────────────────────────────────
CREATE POLICY "enrolments: student or org staff read" ON public.enrolments FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
CREATE POLICY "enrolments: student self insert" ON public.enrolments FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "enrolments: student self delete" ON public.enrolments FOR DELETE
  USING (student_id = auth.uid());

-- ── SUBMISSIONS ──────────────────────────────────────────────
CREATE POLICY "submissions: student or org staff read" ON public.submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
CREATE POLICY "submissions: student self insert" ON public.submissions FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "submissions: student or staff update" ON public.submissions FOR UPDATE
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );

-- ── REVIEWS (append-only — SELECT + INSERT only, no UPDATE/DELETE) ──
CREATE POLICY "reviews: student, reviewer, or safeguarding lead read" ON public.reviews FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND public.is_safeguarding_lead(wi.organisation_id)
    )
  );
CREATE POLICY "reviews: org staff insert" ON public.reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
    )
  );

-- ── VERIFICATIONS ────────────────────────────────────────────
CREATE POLICY "verifications: student or org staff read" ON public.verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
    OR public.current_user_role() = 'employer'  -- verified badge is what employers browse for
  );
CREATE POLICY "verifications: org staff insert" ON public.verifications FOR INSERT
  WITH CHECK (
    verified_by = auth.uid()
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.id = submission_id AND wi.organisation_id = public.current_user_org()
    )
  );

-- ── OPPORTUNITIES ────────────────────────────────────────────
CREATE POLICY "opportunities: public read" ON public.opportunities FOR SELECT USING (true);
CREATE POLICY "opportunities: employer self insert" ON public.opportunities FOR INSERT
  WITH CHECK (employer_id = auth.uid() AND public.current_user_role() = 'employer');
CREATE POLICY "opportunities: employer self update" ON public.opportunities FOR UPDATE
  USING (employer_id = auth.uid());
CREATE POLICY "opportunities: employer self delete" ON public.opportunities FOR DELETE
  USING (employer_id = auth.uid());

-- ── INTEREST ─────────────────────────────────────────────────
-- The student is never a party to this table's RLS on purpose — for
-- an under-18, interest is seen by the organisation first, never the
-- young person directly. Org staff read on behalf of their student;
-- there is deliberately no "student reads their own interest" policy.
CREATE POLICY "interest: employer or org staff read" ON public.interest FOR SELECT
  USING (
    employer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = student_id AND u.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
CREATE POLICY "interest: employer insert" ON public.interest FOR INSERT
  WITH CHECK (employer_id = auth.uid() AND public.current_user_role() = 'employer');
CREATE POLICY "interest: org staff update" ON public.interest FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = student_id AND u.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
