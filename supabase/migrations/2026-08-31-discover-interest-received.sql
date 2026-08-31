-- Opportunities need a type to split into Jobs / Apprenticeships /
-- Internships tabs on student Discover, matching the real old app's
-- tab split (app/discovery/page.tsx, JOB_TYPES_FOR_TAB).
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'job'
  CHECK (type IN ('job','apprenticeship','internship'));

-- The original interest table comment said "there is deliberately no
-- 'student reads their own interest' policy" -- true for under-18s,
-- but the spec's own words are explicit for adults: "Interest
-- received: employers who have expressed interest in them, where the
-- student can send a follow-up." An 18+ student needs to both read
-- and act on (accept/decline) interest raised in them; under-18s still
-- have no path to this table at all -- org staff continue to be the
-- only ones who see it for them.
CREATE POLICY "interest: adult student read own" ON public.interest FOR SELECT
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid()
      AND u.date_of_birth IS NOT NULL AND EXTRACT(YEAR FROM age(u.date_of_birth)) >= 18
    )
  );
CREATE POLICY "interest: adult student update own" ON public.interest FOR UPDATE
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid()
      AND u.date_of_birth IS NOT NULL AND EXTRACT(YEAR FROM age(u.date_of_birth)) >= 18
    )
  );

-- An employer needs to know whether the student behind a piece of
-- shared/public work is under 18 (to show "contact their
-- institution/provider" instead of a direct action) without ever
-- being handed the raw date of birth -- same "reveal only a computed
-- boolean" pattern as posts_feed's author_anonymised.
CREATE OR REPLACE FUNCTION public.students_adult_status(p_student_ids UUID[])
RETURNS TABLE(student_id UUID, is_adult BOOLEAN) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, (u.date_of_birth IS NOT NULL AND EXTRACT(YEAR FROM age(u.date_of_birth)) >= 18)
  FROM public.users u WHERE u.id = ANY(p_student_ids)
$$;
GRANT EXECUTE ON FUNCTION public.students_adult_status(UUID[]) TO authenticated;
