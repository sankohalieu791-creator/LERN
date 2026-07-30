-- Phase 3: widen training_requests.type to support employer interest,
-- routed either directly to an independent adult or to an org admin
-- (about_user_id, added in Phase 1, records who the interest is really about).
ALTER TABLE public.training_requests DROP CONSTRAINT IF EXISTS training_requests_type_check;
ALTER TABLE public.training_requests ADD CONSTRAINT training_requests_type_check
  CHECK (type IN ('training', 'mentorship', 'employer_interest'));
