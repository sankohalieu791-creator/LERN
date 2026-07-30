-- The apply-to-teach form has always let users pick "Employer" as a
-- role_type, but the DB constraint never actually included it — every
-- employer application has been silently rejected since day one.
ALTER TABLE public.instructor_applications DROP CONSTRAINT IF EXISTS instructor_applications_role_type_check;
ALTER TABLE public.instructor_applications ADD CONSTRAINT instructor_applications_role_type_check
  CHECK (role_type IN ('mentor','professor','teacher','coach','dr','employer'));
