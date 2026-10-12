-- ============================================================
-- Self-reported skills: a student can declare a skill and attach
-- evidence with zero institution setup required first -- the real
-- friction point in the existing Skill Wallet (a teacher has to
-- pre-author a whole course + skills + criteria before a student can
-- even start). Deliberately a NEW, separate table, not a repurposing
-- of `skills` (which is always owned by a course_id -> an institution,
-- the wrong shape for "a student invents a name on the spot"): no
-- criteria, no 5-level progression, just a name, one piece of
-- evidence, and a status.
--
-- Trust model, confirmed directly rather than assumed: this is NOT
-- auto-verified on upload. It sits as 'self_reported' until a teacher
-- does one tap to confirm it, becoming 'verified' -- otherwise the
-- word "Verified" stops meaning "a person checked it" anywhere on the
-- platform, which is the actual thing differentiating LERN from a CV.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.self_reported_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id), -- denormalized at insert time from the student's own org, same pattern work_items/placements already use, for simple RLS with no join
  name text not null,
  note text,
  evidence_file_path text not null,
  evidence_file_type text,
  status text not null default 'self_reported' check (status in ('self_reported','verified')),
  confirmed_by uuid references public.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
ALTER TABLE public.self_reported_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_reported_skills: student read own" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: student read own" ON public.self_reported_skills
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "self_reported_skills: student insert own" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: student insert own" ON public.self_reported_skills
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "self_reported_skills: org staff read" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: org staff read" ON public.self_reported_skills
  FOR SELECT USING (
    current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = current_user_org()
  );

-- Employer-facing: only ever a CONFIRMED row, and only for a student
-- who's already discoverable at all (same has_verification() gate
-- protecting the leveled-skills read and the candidate's profile row
-- itself) -- an unconfirmed self-report is never visible to an employer.
DROP POLICY IF EXISTS "self_reported_skills: employer read confirmed for discoverable students" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: employer read confirmed for discoverable students" ON public.self_reported_skills
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND status = 'verified'
    AND has_verification(student_id)
  );
-- Deliberately no UPDATE policy for 'authenticated' at all -- the only
-- write path for status/confirmed_by/confirmed_at is the SECURITY
-- DEFINER function below, same convention as submit_skill_review and
-- set_employer_visibility.

CREATE OR REPLACE FUNCTION public.confirm_self_reported_skill(p_skill_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  IF current_user_role() NOT IN ('institution_staff','provider_staff') THEN
    RAISE EXCEPTION 'only staff can confirm a self-reported skill';
  END IF;

  SELECT organisation_id INTO v_org FROM public.self_reported_skills WHERE id = p_skill_id;
  IF v_org IS NULL OR v_org != current_user_org() THEN
    RAISE EXCEPTION 'not authorised for this student''s organisation';
  END IF;

  UPDATE public.self_reported_skills
  SET status = 'verified', confirmed_by = auth.uid(), confirmed_at = now()
  WHERE id = p_skill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_self_reported_skill(uuid) TO authenticated;


-- ============================================================
-- "Upload work students already do" -- distinguishes these work_items
-- rows from ordinary briefs (both are type='brief', created via
-- different forms) so the Briefs screen can show two separate lists
-- instead of mixing them together.
-- ============================================================
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS is_existing_work boolean NOT NULL DEFAULT false;
