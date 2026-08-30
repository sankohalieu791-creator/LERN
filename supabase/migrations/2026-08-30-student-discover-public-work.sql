CREATE POLICY "verifications: any authenticated read public" ON public.verifications FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "submissions: any authenticated read via public verification" ON public.submissions FOR SELECT
  USING (public.submission_has_public_verification(submissions.id));

CREATE POLICY "work_items: any authenticated read via public verification" ON public.work_items FOR SELECT
  USING (public.work_item_has_public_verification(work_items.id));
