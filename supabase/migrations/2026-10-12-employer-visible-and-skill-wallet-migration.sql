-- ============================================================
-- Two things in one migration, deliberately bundled:
--
-- 1) Closes a real tracking gap: the Skill Wallet tables + the
--    submit_skill_review() RPC were applied directly to the live DB
--    earlier this session and never committed to a tracked migration
--    (they only ever existed in scratch/skill-wallet-migration.sql).
--    Ported here verbatim except for one deliberate fix: the scratch
--    copy of submit_skill_review() has NO organisation check at all.
--    scratch/test-cross-org-block.mjs proves a cross-org exploit (an
--    org-A staff account reviewing an org-B submission) was found and
--    patched live — this migration carries that fix forward instead
--    of silently reintroducing the hole the next time it's replayed.
--    Written idempotent throughout (IF NOT EXISTS / DROP ... IF
--    EXISTS) since these objects already exist live.
--
-- 2) The actual new feature: lets institution staff mark a specific
--    verified piece of a STUDENT'S work as visible to employers, on
--    behalf of students who can't do this themselves (everyone under
--    18 — the existing self-service `visibility='public'` toggle only
--    renders for adults, confirmed in MyWorkPanel.tsx). This is a
--    brand-new, separate boolean column (`employer_visible`), not a
--    change to the existing age-gated `visibility` enum — those two
--    ideas need to stay distinct: `visibility='public'` means
--    literally public, which this product's own copy promises never
--    happens for a minor. `employer_visible` only ever means "shown
--    to vetted employer accounts inside Discover," a narrower claim,
--    settable only by the student's own org's staff via a dedicated
--    RPC (set_employer_visibility, modelled on the same org-check
--    pattern as the submit_skill_review fix above).
--
--    Critical design point, worth restating: getDiscoverWork's
--    employer read access runs through two SHARED RLS helper
--    functions (submission_has_public_verification,
--    work_item_has_public_verification) that are ALSO the entire
--    basis of two separate "any authenticated user" policies added in
--    2026-08-30-student-discover-public-work.sql. Widening those
--    shared helpers to include employer_visible would silently grant
--    ANY logged-in user of ANY role read access to a minor's work the
--    institution only meant to show employers. So this migration adds
--    two BRAND NEW, employer-only helper functions instead
--    (submission_visible_to_employer, work_item_visible_to_employer)
--    and repoints only the two employer-specific policies at them —
--    the shared helpers and the "any authenticated" policies that
--    depend on them are completely untouched.
-- ============================================================


-- ───────────────────────── courses ─────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses: org read" ON public.courses;
CREATE POLICY "courses: org read" ON public.courses
  FOR SELECT USING (organisation_id = current_user_org());

DROP POLICY IF EXISTS "courses: org staff write" ON public.courses;
CREATE POLICY "courses: org staff write" ON public.courses
  FOR INSERT WITH CHECK (
    organisation_id = current_user_org()
    AND current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
  );

DROP POLICY IF EXISTS "courses: org staff update" ON public.courses;
CREATE POLICY "courses: org staff update" ON public.courses
  FOR UPDATE USING (
    organisation_id = current_user_org()
    AND current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
  );

DROP POLICY IF EXISTS "courses: org staff delete" ON public.courses;
CREATE POLICY "courses: org staff delete" ON public.courses
  FOR DELETE USING (
    organisation_id = current_user_org()
    AND current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
  );

-- ───────────────────────── skills ─────────────────────────
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  unit_label text,
  sort_order int not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills: org read" ON public.skills;
CREATE POLICY "skills: org read" ON public.skills
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.organisation_id = current_user_org())
  );

DROP POLICY IF EXISTS "skills: org staff write" ON public.skills;
CREATE POLICY "skills: org staff write" ON public.skills
  FOR INSERT WITH CHECK (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.organisation_id = current_user_org())
  );

DROP POLICY IF EXISTS "skills: org staff update" ON public.skills;
CREATE POLICY "skills: org staff update" ON public.skills
  FOR UPDATE USING (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.organisation_id = current_user_org())
  );

DROP POLICY IF EXISTS "skills: org staff delete" ON public.skills;
CREATE POLICY "skills: org staff delete" ON public.skills
  FOR DELETE USING (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.organisation_id = current_user_org())
  );

-- NEW (this migration): employers can read skill names/unit labels —
-- no PII on this table, just org-authored skill labels, so a flat
-- employer-wide read is fine (no need to also open up `courses`).
DROP POLICY IF EXISTS "skills: employer read" ON public.skills;
CREATE POLICY "skills: employer read" ON public.skills
  FOR SELECT USING (current_user_role() = 'employer' AND NOT current_user_is_guest());

-- ───────────────────────── skill_criteria ─────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_criteria (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  text text not null,
  sort_order int not null default 0
);
ALTER TABLE public.skill_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_criteria: org read" ON public.skill_criteria;
CREATE POLICY "skill_criteria: org read" ON public.skill_criteria
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.skills s JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = skill_id AND c.organisation_id = current_user_org()
    )
  );

DROP POLICY IF EXISTS "skill_criteria: org staff write" ON public.skill_criteria;
CREATE POLICY "skill_criteria: org staff write" ON public.skill_criteria
  FOR INSERT WITH CHECK (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (
      SELECT 1 FROM public.skills s JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = skill_id AND c.organisation_id = current_user_org()
    )
  );

DROP POLICY IF EXISTS "skill_criteria: org staff update" ON public.skill_criteria;
CREATE POLICY "skill_criteria: org staff update" ON public.skill_criteria
  FOR UPDATE USING (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (
      SELECT 1 FROM public.skills s JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = skill_id AND c.organisation_id = current_user_org()
    )
  );

DROP POLICY IF EXISTS "skill_criteria: org staff delete" ON public.skill_criteria;
CREATE POLICY "skill_criteria: org staff delete" ON public.skill_criteria
  FOR DELETE USING (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND EXISTS (
      SELECT 1 FROM public.skills s JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = skill_id AND c.organisation_id = current_user_org()
    )
  );

-- ───────────────────────── work_item_skills ─────────────────────────
CREATE TABLE IF NOT EXISTS public.work_item_skills (
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (work_item_id, skill_id)
);
ALTER TABLE public.work_item_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_item_skills: org read" ON public.work_item_skills;
CREATE POLICY "work_item_skills: org read" ON public.work_item_skills
  FOR SELECT USING (work_item_org(work_item_id) = current_user_org());

DROP POLICY IF EXISTS "work_item_skills: org staff write" ON public.work_item_skills;
CREATE POLICY "work_item_skills: org staff write" ON public.work_item_skills
  FOR INSERT WITH CHECK (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND work_item_org(work_item_id) = current_user_org()
  );

DROP POLICY IF EXISTS "work_item_skills: org staff delete" ON public.work_item_skills;
CREATE POLICY "work_item_skills: org staff delete" ON public.work_item_skills
  FOR DELETE USING (
    current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
    AND work_item_org(work_item_id) = current_user_org()
  );

-- ───────────────────────── submission_skills ─────────────────────────
CREATE TABLE IF NOT EXISTS public.submission_skills (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (submission_id, skill_id)
);
ALTER TABLE public.submission_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submission_skills: student or org staff read" ON public.submission_skills;
CREATE POLICY "submission_skills: student or org staff read" ON public.submission_skills
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.submissions sub WHERE sub.id = submission_id AND sub.student_id = auth.uid())
    OR (
      current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
      AND EXISTS (
        SELECT 1 FROM public.submissions sub WHERE sub.id = submission_id
        AND work_item_org(sub.work_item_id) = current_user_org()
      )
    )
  );

DROP POLICY IF EXISTS "submission_skills: student self insert" ON public.submission_skills;
CREATE POLICY "submission_skills: student self insert" ON public.submission_skills
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.submissions sub WHERE sub.id = submission_id AND sub.student_id = auth.uid())
  );

-- ───────────────────────── student_skills (the rollup) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level text not null default 'not_started' check (level in ('not_started','beginner','developing','secure','advanced')),
  verified_count int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (student_id, skill_id)
);
ALTER TABLE public.student_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_skills: student or org staff read" ON public.student_skills;
CREATE POLICY "student_skills: student or org staff read" ON public.student_skills
  FOR SELECT USING (
    student_id = auth.uid()
    OR (
      current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
      AND EXISTS (
        SELECT 1 FROM public.skills s JOIN public.courses c ON c.id = s.course_id
        WHERE s.id = skill_id AND c.organisation_id = current_user_org()
      )
    )
  );
-- deliberately no insert/update/delete policy for 'authenticated' —
-- only the SECURITY DEFINER submit_skill_review() writes this table.

-- NEW (this migration): employers can see a skill's name+level for any
-- student who is already discoverable at all (same has_verification()
-- gate protecting their profile row) — a level alone reveals no actual
-- work content, but this still needs a real RLS policy, not just a UI
-- check, since nothing granted employers read on this table before.
DROP POLICY IF EXISTS "student_skills: employer read for discoverable students" ON public.student_skills;
CREATE POLICY "student_skills: employer read for discoverable students" ON public.student_skills
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND has_verification(student_id)
  );

-- ───────────────────────── review_criteria_results ─────────────────────────
CREATE TABLE IF NOT EXISTS public.review_criteria_results (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  criterion_id uuid not null references public.skill_criteria(id),
  result text not null check (result in ('met','partly_met','not_met')),
  created_at timestamptz not null default now()
);
ALTER TABLE public.review_criteria_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_criteria_results: student, reviewer, or org staff read" ON public.review_criteria_results;
CREATE POLICY "review_criteria_results: student, reviewer, or org staff read" ON public.review_criteria_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reviews r JOIN public.submissions s ON s.id = r.submission_id
      WHERE r.id = review_id AND (
        s.student_id = auth.uid()
        OR r.reviewer_id = auth.uid()
        OR (
          current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])
          AND work_item_org(s.work_item_id) = current_user_org()
        )
      )
    )
  );
-- no insert policy for 'authenticated' — only submit_skill_review() writes this.

-- ───────────────────────── the one write path (with the cross-org fix) ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_skill_review(
  p_submission_id uuid,
  p_decision text,
  p_feedback text,
  p_criteria_results jsonb,
  p_level_overrides jsonb default '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id uuid;
  v_work_item_id uuid;
  v_skill_id uuid;
  v_credited boolean;
  v_not_met_count int;
  v_met_count int;
  v_total_count int;
  v_current_level text;
  v_next_level text;
  v_override text;
BEGIN
  IF current_user_role() NOT IN ('institution_staff', 'provider_staff') THEN
    RAISE EXCEPTION 'only staff can review skill work';
  END IF;

  SELECT work_item_id INTO v_work_item_id FROM public.submissions WHERE id = p_submission_id;
  IF v_work_item_id IS NULL THEN
    RAISE EXCEPTION 'submission not found';
  END IF;

  -- Cross-org fix (not in the original scratch-file version): without
  -- this, any org's staff could review/credit any OTHER org's
  -- submission. Mirrors the exact org-check pattern already proven
  -- throughout this codebase's other RLS policies/RPCs.
  IF public.submission_work_item_org(p_submission_id) != public.current_user_org() THEN
    RAISE EXCEPTION 'not authorised for this submission''s organisation';
  END IF;

  INSERT INTO public.reviews (submission_id, reviewer_id, decision, feedback)
  VALUES (p_submission_id, auth.uid(), p_decision, nullif(p_feedback, ''))
  RETURNING id INTO v_review_id;

  IF p_criteria_results IS NOT NULL THEN
    INSERT INTO public.review_criteria_results (review_id, criterion_id, result)
    SELECT v_review_id, (r->>'criterion_id')::uuid, r->>'result'
    FROM jsonb_array_elements(p_criteria_results) r;
  END IF;

  IF p_decision = 'verified' THEN
    FOR v_skill_id IN
      SELECT skill_id FROM public.submission_skills WHERE submission_id = p_submission_id
    LOOP
      SELECT
        count(*) FILTER (WHERE cr.result = 'not_met'),
        count(*) FILTER (WHERE cr.result = 'met'),
        count(*)
      INTO v_not_met_count, v_met_count, v_total_count
      FROM public.review_criteria_results cr
      JOIN public.skill_criteria sc ON sc.id = cr.criterion_id
      WHERE cr.review_id = v_review_id AND sc.skill_id = v_skill_id;

      v_credited := v_total_count > 0;
      IF NOT v_credited THEN
        CONTINUE;
      END IF;

      SELECT level INTO v_current_level FROM public.student_skills
      WHERE student_id = (SELECT student_id FROM public.submissions WHERE id = p_submission_id) AND skill_id = v_skill_id;
      v_current_level := coalesce(v_current_level, 'not_started');

      v_override := p_level_overrides->>(v_skill_id::text);

      IF v_override IS NOT NULL THEN
        v_next_level := v_override;
      ELSIF v_not_met_count > 0 THEN
        v_next_level := v_current_level;
      ELSIF v_current_level = 'not_started' THEN
        v_next_level := 'beginner';
      ELSIF v_met_count = v_total_count THEN
        v_next_level := CASE v_current_level
          WHEN 'beginner' THEN 'developing'
          WHEN 'developing' THEN 'secure'
          WHEN 'secure' THEN 'advanced'
          ELSE 'advanced'
        END;
      ELSE
        v_next_level := v_current_level;
      END IF;

      INSERT INTO public.student_skills (student_id, skill_id, level, verified_count, updated_at, updated_by)
      VALUES (
        (SELECT student_id FROM public.submissions WHERE id = p_submission_id),
        v_skill_id, v_next_level, 1, now(), auth.uid()
      )
      ON CONFLICT (student_id, skill_id) DO UPDATE
      SET level = v_next_level,
          verified_count = public.student_skills.verified_count + 1,
          updated_at = now(),
          updated_by = auth.uid();
    END LOOP;
  END IF;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_skill_review(uuid, text, text, jsonb, jsonb) TO authenticated;


-- ============================================================
-- NEW FEATURE: institution-granted employer visibility
-- ============================================================

ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS employer_visible boolean NOT NULL DEFAULT false;

-- Brand-new, employer-only helpers — NOT a change to the existing
-- submission_has_public_verification / work_item_has_public_verification
-- (2026-08-30-fix-work-items-rls-recursion.sql), which the "any
-- authenticated user" policies also depend on. Keeping these separate
-- is the entire point: widening the shared ones would leak minors'
-- employer-only-visible work to every logged-in user, not just employers.
CREATE OR REPLACE FUNCTION public.submission_visible_to_employer(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verifications v
    WHERE v.submission_id = p_submission_id
      AND v.revoked_at IS NULL
      AND (v.visibility = 'public' OR v.employer_visible = true)
  )
$$;

CREATE OR REPLACE FUNCTION public.work_item_visible_to_employer(p_work_item_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.verifications v ON v.submission_id = s.id
    WHERE s.work_item_id = p_work_item_id
      AND v.revoked_at IS NULL
      AND (v.visibility = 'public' OR v.employer_visible = true)
  )
$$;

-- Repoint ONLY the two employer-specific policies. The "any
-- authenticated" policies on these same tables are untouched.
DROP POLICY IF EXISTS "submissions: employer read via public verification" ON public.submissions;
CREATE POLICY "submissions: employer read via public verification" ON public.submissions FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND public.submission_visible_to_employer(submissions.id)
  );

DROP POLICY IF EXISTS "work_items: employer read via public verification" ON public.work_items;
CREATE POLICY "work_items: employer read via public verification" ON public.work_items FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND public.work_item_visible_to_employer(work_items.id)
  );

-- verifications' own employer branch is inlined, not shared via a
-- helper — safe to extend directly in place.
DROP POLICY IF EXISTS "verifications: student or org staff read" ON public.verifications;
CREATE POLICY "verifications: student or org staff read" ON public.verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR (
      public.current_user_role() IN ('institution_staff','provider_staff')
      AND public.submission_work_item_org(submission_id) = public.current_user_org()
    )
    OR (public.current_user_role() = 'employer' AND NOT public.current_user_is_guest() AND (visibility = 'public' OR employer_visible = true))
    OR (public.current_user_is_guest() AND public.guest_can_see_verification(verifications.id))
  );

-- has_verification()'s single caller ("users: self read") needs the
-- same OR, so Discover's embedded student:users(...) join doesn't come
-- back null for employer-visible-only students. Also restores the
-- `revoked_at IS NULL` filter an interim version had
-- (2026-08-26-criteria-upload-safety-revoke.sql) but the final version
-- dropped (2026-08-28-employer-discover-safeguarding-fix.sql) — pure
-- tightening, a revoked verification shouldn't keep an employer able
-- to read the student's bare profile row.
CREATE OR REPLACE FUNCTION public.has_verification(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.submissions s ON s.id = v.submission_id
    WHERE s.student_id = p_student_id
      AND v.revoked_at IS NULL
      AND (v.visibility = 'public' OR v.employer_visible = true)
  )
$$;

-- The one write path for employer_visible — mirrors submit_skill_review's
-- org-check pattern. No RLS UPDATE policy needed; SECURITY DEFINER +
-- the checks below is this codebase's established convention for
-- sensitive writes (matches submit_skill_review, has_verification, etc).
CREATE OR REPLACE FUNCTION public.set_employer_visibility(p_verification_id UUID, p_visible BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_submission_id UUID;
  v_org UUID;
BEGIN
  IF public.current_user_role() NOT IN ('institution_staff','provider_staff') THEN
    RAISE EXCEPTION 'only staff can set employer visibility';
  END IF;

  SELECT submission_id INTO v_submission_id
  FROM public.verifications WHERE id = p_verification_id AND revoked_at IS NULL;
  IF v_submission_id IS NULL THEN
    RAISE EXCEPTION 'verification not found, or has been revoked';
  END IF;

  v_org := public.submission_work_item_org(v_submission_id);
  IF v_org IS NULL OR v_org != public.current_user_org() THEN
    RAISE EXCEPTION 'not authorised for this student''s organisation';
  END IF;

  UPDATE public.verifications SET employer_visible = p_visible WHERE id = p_verification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_employer_visibility(uuid, boolean) TO authenticated;


-- ============================================================
-- Work Experience — additive placement fields
-- ============================================================
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS location_mode text CHECK (location_mode IN ('in_person','virtual')),
  ADD COLUMN IF NOT EXISTS time_commitment text,
  ADD COLUMN IF NOT EXISTS employer_lead_name text,
  ADD COLUMN IF NOT EXISTS employer_lead_email text,
  ADD COLUMN IF NOT EXISTS coordinator_id uuid REFERENCES public.users(id);
