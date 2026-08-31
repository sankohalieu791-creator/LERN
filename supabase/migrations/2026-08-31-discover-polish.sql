-- Salary is freeform (matches the old app's "£25k-£30k" style strings,
-- not a structured min/max) -- optional, shown on the card when set.
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS salary TEXT;

-- Student → opportunity interest ("Apply"). This is the REVERSE
-- direction from the existing `interest` table (employer → student):
-- a student expressing interest in a posting an employer put up,
-- rather than an employer expressing interest in a student's work.
-- Same org-routing shape as `interest` though -- an under-18's
-- application is never visible to the employer directly, their
-- organisation sees and forwards it; an 18+ student's goes straight
-- to the employer.
CREATE TABLE public.opportunity_interest (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);
CREATE INDEX idx_opportunity_interest_opportunity_id ON public.opportunity_interest(opportunity_id);
CREATE INDEX idx_opportunity_interest_student_id     ON public.opportunity_interest(student_id);
ALTER TABLE public.opportunity_interest ENABLE ROW LEVEL SECURITY;

-- A student always sees their own applications.
CREATE POLICY "opportunity_interest: student read own" ON public.opportunity_interest FOR SELECT
  USING (student_id = auth.uid());
-- An 18+ student applies directly. An under-18's application still
-- gets written the same way (the student is the one tapping Apply),
-- but the employer-read policy below is what actually gates who sees
-- it next -- same "insert always allowed, read is where the routing
-- happens" shape as the rest of this schema's age handling.
CREATE POLICY "opportunity_interest: student insert own" ON public.opportunity_interest FOR INSERT
  WITH CHECK (student_id = auth.uid() AND public.current_user_role() = 'student');
-- Org staff see applications from their own under-18 students (and
-- can act on their behalf), same shape as the `interest` table.
CREATE POLICY "opportunity_interest: org staff read and update" ON public.opportunity_interest FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = student_id AND u.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
CREATE POLICY "opportunity_interest: org staff update" ON public.opportunity_interest FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = student_id AND u.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
-- The employer sees applications against their own postings, but only
-- for students who are 18+ -- an under-18's application is visible to
-- their organisation only (above), never to the employer directly.
CREATE POLICY "opportunity_interest: employer read adult applicants" ON public.opportunity_interest FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = opportunity_id AND o.employer_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = student_id
      AND u.date_of_birth IS NOT NULL AND EXTRACT(YEAR FROM age(u.date_of_birth)) >= 18
    )
  );
