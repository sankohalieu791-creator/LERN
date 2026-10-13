-- "When I press the publish button, it then goes to my profile as a
-- certain proven skill, if that makes sense" -- a skill goal and its
-- check-ins used to be employer-visible the moment they existed at
-- all. Now they're a private, own-view-only work-in-progress log by
-- default; a student explicitly publishes a goal once they're ready
-- to put it in front of employers, which is the only thing that
-- flips it into Discover's Skills tab.
ALTER TABLE public.skill_goals
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- No UPDATE policy existed on skill_goals before this -- the original
-- design never needed one (nothing on a goal itself ever changed after
-- creation). Publishing is the first thing that does.
DROP POLICY IF EXISTS "skill_goals: student update own" ON public.skill_goals;
CREATE POLICY "skill_goals: student update own" ON public.skill_goals
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Replaces the original employer policy -- same has_verification()
-- gate, now additionally requiring the student to have actually
-- published this specific goal.
DROP POLICY IF EXISTS "skill_goals: employer read for discoverable students" ON public.skill_goals;
CREATE POLICY "skill_goals: employer read published for discoverable students" ON public.skill_goals
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND published_at IS NOT NULL
    AND has_verification(student_id)
  );

-- Same for the check-ins underneath a goal -- an employer should never
-- see check-in history for a goal the student hasn't published, even
-- if they somehow had the goal id.
DROP POLICY IF EXISTS "skill_checkins: employer read for discoverable students" ON public.skill_checkins;
CREATE POLICY "skill_checkins: employer read for published discoverable students" ON public.skill_checkins
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND EXISTS (
      SELECT 1 FROM public.skill_goals g
      WHERE g.id = skill_checkins.goal_id AND g.published_at IS NOT NULL AND has_verification(g.student_id)
    )
  );
