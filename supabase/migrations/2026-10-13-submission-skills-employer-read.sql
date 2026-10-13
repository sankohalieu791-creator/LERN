-- "I see the skills -- Copywriting for Social, Advanced -- there's no
-- attachment. How can I know they didn't just put it?" (direct
-- feedback). A level badge with nothing behind it is exactly as
-- unverifiable as a self-claimed skill with no evidence file, which is
-- the whole reason self_reported_skills requires one. For a LEVELED
-- skill, the real evidence is the verified work it was earned from --
-- this lets an employer read which of a student's already-verified,
-- already-employer-visible submissions were tagged with a given skill,
-- via the existing submission_skills join table, so "Advanced" can be
-- clicked through to the actual piece(s) of work behind it.
--
-- Deliberately narrow: gated on has_verification(), the exact same
-- function already used to gate every other employer-facing table this
-- session (self_reported_skills, etc), and only reachable via a
-- submission_id the caller already holds from a prior verified-work
-- query -- this grants no new ability to browse a student's work from
-- scratch, only to see which already-visible pieces back a given skill.
DROP POLICY IF EXISTS "submission_skills: employer read for discoverable students" ON public.submission_skills;
CREATE POLICY "submission_skills: employer read for discoverable students" ON public.submission_skills
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_skills.submission_id
      AND has_verification(s.student_id)
    )
  );
