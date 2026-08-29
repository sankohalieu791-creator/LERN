CREATE OR REPLACE FUNCTION public.work_item_org(p_work_item_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organisation_id FROM public.work_items WHERE id = p_work_item_id
$$;

CREATE OR REPLACE FUNCTION public.submission_work_item_org(p_submission_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wi.organisation_id
  FROM public.submissions s
  JOIN public.work_items wi ON wi.id = s.work_item_id
  WHERE s.id = p_submission_id
$$;

CREATE OR REPLACE FUNCTION public.work_item_has_public_verification(p_work_item_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.verifications v ON v.submission_id = s.id
    WHERE s.work_item_id = p_work_item_id AND v.visibility = 'public'
  )
$$;

CREATE OR REPLACE FUNCTION public.work_item_has_guest_shared_verification(p_work_item_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.verifications v ON v.submission_id = s.id
    WHERE s.work_item_id = p_work_item_id AND public.guest_can_see_verification(v.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.submission_has_public_verification(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.verifications v WHERE v.submission_id = p_submission_id AND v.visibility = 'public')
$$;

CREATE OR REPLACE FUNCTION public.submission_has_guest_shared_verification(p_submission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.verifications v WHERE v.submission_id = p_submission_id AND public.guest_can_see_verification(v.id))
$$;

-- work_items policies now call helpers instead of raw-querying
-- submissions/verifications directly -- that raw query was the other
-- half of the cycle (submissions/verifications policies raw-query
-- work_items right back, below).
DROP POLICY IF EXISTS "work_items: employer read via public verification" ON public.work_items;
CREATE POLICY "work_items: employer read via public verification" ON public.work_items FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND public.work_item_has_public_verification(work_items.id)
  );

DROP POLICY IF EXISTS "work_items: guest read via share" ON public.work_items;
CREATE POLICY "work_items: guest read via share" ON public.work_items FOR SELECT
  USING (
    public.current_user_is_guest()
    AND public.work_item_has_guest_shared_verification(work_items.id)
  );

-- submissions policies: every raw reference to work_items or
-- verifications replaced with the equivalent helper call.
DROP POLICY IF EXISTS "submissions: student or org staff read" ON public.submissions;
CREATE POLICY "submissions: student or org staff read" ON public.submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR (
      public.current_user_role() IN ('institution_staff','provider_staff')
      AND public.work_item_org(work_item_id) = public.current_user_org()
    )
  );

DROP POLICY IF EXISTS "submissions: org staff moderate" ON public.submissions;
CREATE POLICY "submissions: org staff moderate" ON public.submissions FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND public.work_item_org(work_item_id) = public.current_user_org()
  );

DROP POLICY IF EXISTS "submissions: org staff insert on behalf of student" ON public.submissions;
CREATE POLICY "submissions: org staff insert on behalf of student" ON public.submissions FOR INSERT
  WITH CHECK (
    public.current_user_email_confirmed()
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND public.work_item_org(work_item_id) = public.current_user_org()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = submissions.student_id AND u.organisation_id = public.current_user_org() AND u.role = 'student')
  );

DROP POLICY IF EXISTS "submissions: employer read via public verification" ON public.submissions;
CREATE POLICY "submissions: employer read via public verification" ON public.submissions FOR SELECT
  USING (
    public.current_user_role() = 'employer' AND NOT public.current_user_is_guest()
    AND public.submission_has_public_verification(submissions.id)
  );

DROP POLICY IF EXISTS "submissions: guest read via share" ON public.submissions;
CREATE POLICY "submissions: guest read via share" ON public.submissions FOR SELECT
  USING (
    public.current_user_is_guest()
    AND public.submission_has_guest_shared_verification(submissions.id)
  );

-- verifications: same fix for its staff-read branch.
DROP POLICY IF EXISTS "verifications: student or org staff read" ON public.verifications;
CREATE POLICY "verifications: student or org staff read" ON public.verifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.student_id = auth.uid())
    OR (
      public.current_user_role() IN ('institution_staff','provider_staff')
      AND public.submission_work_item_org(submission_id) = public.current_user_org()
    )
    OR (public.current_user_role() = 'employer' AND NOT public.current_user_is_guest() AND visibility = 'public')
    OR (public.current_user_is_guest() AND public.guest_can_see_verification(verifications.id))
  );
