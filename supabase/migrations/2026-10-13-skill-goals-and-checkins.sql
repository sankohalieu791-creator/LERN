-- ============================================================
-- Skill goals + weekly check-ins -- replaces the old one-shot
-- "self_reported_skills" (name + note + one file, done forever) with
-- an ongoing log: a student sets a goal (what they're learning,
-- optionally a target date), then checks in as often as they like --
-- each check-in is its own write-up + its own required evidence file,
-- real server-timestamped, building a visible timeline of actual
-- progress rather than a single unverifiable snapshot.
--
-- Still no teacher/staff step anywhere in the write path, same
-- reasoning as the original self_reported_skills design: a vetted
-- institution's own membership is the trust signal, not a second
-- per-entry check. What makes THIS harder to fake than the old single
-- upload isn't scrutiny of any one entry, it's that a real multi-week
-- spread of real dated entries costs real time to fabricate -- the
-- same kind of trust the rest of the platform already leans on.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.skill_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id), -- denormalized at insert time, same pattern as self_reported_skills/work_items
  name text not null,
  target text,       -- "what I want to be able to do by the deadline" -- optional, encouraged not required
  target_date date,  -- optional deadline
  created_at timestamptz not null default now()
);
ALTER TABLE public.skill_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_goals: student read own" ON public.skill_goals;
CREATE POLICY "skill_goals: student read own" ON public.skill_goals
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "skill_goals: student insert own" ON public.skill_goals;
CREATE POLICY "skill_goals: student insert own" ON public.skill_goals
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "skill_goals: org staff read" ON public.skill_goals;
CREATE POLICY "skill_goals: org staff read" ON public.skill_goals
  FOR SELECT USING (
    current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = current_user_org()
  );

DROP POLICY IF EXISTS "skill_goals: employer read for discoverable students" ON public.skill_goals;
CREATE POLICY "skill_goals: employer read for discoverable students" ON public.skill_goals
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND has_verification(student_id)
  );

CREATE TABLE IF NOT EXISTS public.skill_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.skill_goals(id) on delete cascade,
  content text not null,
  evidence_file_path text not null,
  evidence_file_type text,
  created_at timestamptz not null default now()
);
ALTER TABLE public.skill_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_checkins: student read own" ON public.skill_checkins;
CREATE POLICY "skill_checkins: student read own" ON public.skill_checkins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.skill_goals g WHERE g.id = skill_checkins.goal_id AND g.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "skill_checkins: student insert own" ON public.skill_checkins;
CREATE POLICY "skill_checkins: student insert own" ON public.skill_checkins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.skill_goals g WHERE g.id = skill_checkins.goal_id AND g.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "skill_checkins: org staff read" ON public.skill_checkins;
CREATE POLICY "skill_checkins: org staff read" ON public.skill_checkins
  FOR SELECT USING (
    current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (SELECT 1 FROM public.skill_goals g WHERE g.id = skill_checkins.goal_id AND g.organisation_id = current_user_org())
  );

DROP POLICY IF EXISTS "skill_checkins: employer read for discoverable students" ON public.skill_checkins;
CREATE POLICY "skill_checkins: employer read for discoverable students" ON public.skill_checkins
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND EXISTS (SELECT 1 FROM public.skill_goals g WHERE g.id = skill_checkins.goal_id AND has_verification(g.student_id))
  );

-- No UPDATE policy on either table -- same as self_reported_skills, a
-- check-in is complete the moment it's posted, nothing to edit after.

-- Carry over any existing self-reported skills as a goal with exactly
-- one check-in (its original note + evidence file), rather than
-- dropping that data. IDs are preserved 1:1 so this is safe to run
-- more than once.
INSERT INTO public.skill_goals (id, student_id, organisation_id, name, created_at)
SELECT id, student_id, organisation_id, name, created_at
FROM public.self_reported_skills
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.skill_checkins (goal_id, content, evidence_file_path, evidence_file_type, created_at)
SELECT s.id, COALESCE(NULLIF(s.note, ''), 'No write-up was given for this one.'), s.evidence_file_path, s.evidence_file_type, s.created_at
FROM public.self_reported_skills s
WHERE s.evidence_file_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.skill_checkins c WHERE c.goal_id = s.id);
