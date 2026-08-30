ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('submission_received','work_returned','work_verified','work_revoked','employer_interest','report','session_started'));
