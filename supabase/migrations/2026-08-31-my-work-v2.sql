ALTER TABLE public.work_items DROP CONSTRAINT IF EXISTS work_items_type_check;
ALTER TABLE public.work_items ADD CONSTRAINT work_items_type_check
  CHECK (type IN ('brief','course','workshop','assignment'));

ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('beginner','intermediate','advanced'));
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS duration_label TEXT;

-- A student currently has no read path to their own organisation's
-- `type` at all (organisations_public deliberately exposes name only —
-- "org type is never shown to students"). My Work's tab set genuinely
-- needs to know school vs training-provider though, so this is a
-- narrow, safe addition: it reveals only the caller's OWN org's type,
-- nothing about any other organisation.
CREATE OR REPLACE FUNCTION public.my_org_type()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.type FROM public.organisations o JOIN public.users u ON u.organisation_id = o.id WHERE u.id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_org_type() TO authenticated;

-- A student can only read their OWN row in `users` (RLS), so there is
-- no way for the My Work "N joined" count on a course/workshop card to
-- come from a real query today. This exposes only a headcount — no
-- names, no other columns — scoped to the same audience the work item
-- itself is already visible to (its group if it has one, else the
-- whole organisation).
CREATE OR REPLACE FUNCTION public.work_item_member_count(p_work_item_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER FROM public.users u
  WHERE u.role = 'student'
    AND (
      (SELECT wi.group_id FROM public.work_items wi WHERE wi.id = p_work_item_id) IS NOT NULL
      AND u.group_id = (SELECT wi.group_id FROM public.work_items wi WHERE wi.id = p_work_item_id)
      OR
      (SELECT wi.group_id FROM public.work_items wi WHERE wi.id = p_work_item_id) IS NULL
      AND u.organisation_id = (SELECT wi.organisation_id FROM public.work_items wi WHERE wi.id = p_work_item_id)
    )
$$;
GRANT EXECUTE ON FUNCTION public.work_item_member_count(UUID) TO authenticated;

-- ── Example content so the rebuilt My Work isn't an empty screen ──
-- Institution (school) test org: a brief, an assignment, a workshop.
INSERT INTO public.work_items (organisation_id, type, title, topic, description, assignment, criteria, level, duration_label, deadline, mode, created_by)
VALUES (
  'b17ac774-9b55-4a69-bf01-99de6586bc5e', 'brief', 'Career', 'Career development',
  'Join to discuss about your future career job.', 'Write a short plan for the career path you want to explore, and one step you''ll take this month.',
  'Names a realistic goal and one concrete action.', 'beginner', '1w', NULL, NULL,
  '7bf83845-680d-427e-ad0e-5f2a02fd5c92'
);

INSERT INTO public.work_items (organisation_id, type, title, topic, description, assignment, criteria, deadline, created_by)
VALUES (
  'b17ac774-9b55-4a69-bf01-99de6586bc5e', 'assignment', 'Seneca assignment', 'Science',
  'Complete the set Seneca module for this week.', 'Finish the assigned Seneca module and submit your score.',
  'Module completed with a score of 70% or higher.', now() + interval '5 days',
  '7bf83845-680d-427e-ad0e-5f2a02fd5c92'
);

INSERT INTO public.work_items (organisation_id, type, title, topic, description, criteria, mode, starts_at, created_by)
VALUES (
  'b17ac774-9b55-4a69-bf01-99de6586bc5e', 'workshop', 'Knife crime awareness', 'Safety',
  'Join us to discuss knife crime.', 'Attendance recorded for the session.', 'online', now() + interval '2 days',
  '7bf83845-680d-427e-ad0e-5f2a02fd5c92'
);

-- Training provider test org: a course, an assignment, a workshop.
INSERT INTO public.work_items (organisation_id, type, title, topic, description, criteria, level, duration_label, mode, created_by)
VALUES (
  '280de29e-4321-44bd-9438-02fd956f5330', 'course', 'Science Biology', 'Science',
  'An introduction to biology fundamentals.', 'All modules completed.', 'intermediate', '3w', 'online',
  '430c124f-f5ad-48d7-afbb-5c7a794bae66'
);

INSERT INTO public.work_items (organisation_id, type, title, topic, description, assignment, criteria, deadline, created_by)
VALUES (
  '280de29e-4321-44bd-9438-02fd956f5330', 'assignment', 'Portfolio draft', 'Coursework',
  'Submit a first draft of your portfolio.', 'Upload a first draft of your portfolio for feedback.',
  'A draft is attached or written, covering at least two pieces of work.', now() + interval '7 days',
  '430c124f-f5ad-48d7-afbb-5c7a794bae66'
);

INSERT INTO public.work_items (organisation_id, type, title, topic, description, criteria, mode, starts_at, created_by)
VALUES (
  '280de29e-4321-44bd-9438-02fd956f5330', 'workshop', 'Intro session', 'Onboarding',
  'A live intro to the course and how it runs.', 'Attendance recorded for the session.', 'online', now() + interval '1 day',
  '430c124f-f5ad-48d7-afbb-5c7a794bae66'
);
