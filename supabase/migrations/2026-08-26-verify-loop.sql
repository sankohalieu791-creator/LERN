-- ============================================================
-- LERN v2 — the verify loop
--
-- Wires: submit -> notify reviewer -> tutor reviews -> verify/return
-- cascades to submissions.status + verifications, notify student ->
-- verified work carries verifier + date.
--
-- Two safeguarding fixes to the previous migration, made explicit here:
--
-- 1. Removes direct client UPDATE access to `submissions` entirely.
--    A tutor could otherwise flip status to 'verified' with no matching
--    `reviews` row — the log would no longer be a complete record of
--    every decision. Status now changes ONLY as a side effect of a
--    `reviews` INSERT, via the trigger below.
--
-- 2. Removes direct client INSERT access to `verifications`. Same
--    reasoning — a verification with no backing review entry would be
--    an unlogged, unaccountable "verified" state. Only the trigger
--    (SECURITY DEFINER, runs as the migration owner, bypasses RLS) may
--    write to this table now.
--
-- Run this once, after 2026-08-26-rebuild-schema-v2.sql, in the
-- Supabase SQL Editor.
-- ============================================================


-- ============================================================
-- PART 1 — Close the direct-write holes from the previous migration
-- ============================================================

DROP POLICY IF EXISTS "submissions: student or staff update" ON public.submissions;
DROP POLICY IF EXISTS "verifications: org staff insert"       ON public.verifications;
-- No replacement policies — with RLS enabled and no policy for an
-- operation, that operation is denied outright for every ordinary role.
-- Only the SECURITY DEFINER trigger below can still write these.


-- ============================================================
-- PART 2 — Notifications
-- ============================================================

CREATE TABLE public.notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('submission_received','work_returned','work_verified')),
  submission_id  UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  read           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread  ON public.notifications(user_id, read) WHERE read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: owner read"   ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications: owner update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
-- No INSERT policy for clients — notifications are only ever created by
-- the two triggers below (SECURITY DEFINER, bypass RLS). A student or
-- tutor forging their own notification row isn't a real risk here, but
-- there's no legitimate reason to allow it either.


-- ============================================================
-- PART 3 — STEP 1: submit work -> notify the student's own org's staff
-- ============================================================

-- "The reviewer is always the student's OWN organisation's tutor. Never
-- the employer" — this trigger only ever reaches staff at the work
-- item's organisation, which (per the work_items RLS) is the student's
-- own org; there is no path here that can route to an employer.
CREATE OR REPLACE FUNCTION public.notify_on_submission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organisation_id INTO v_org FROM public.work_items WHERE id = NEW.work_item_id;

  INSERT INTO public.notifications (user_id, type, submission_id)
  SELECT id, 'submission_received', NEW.id
  FROM public.users
  WHERE organisation_id = v_org AND role IN ('institution_staff','provider_staff');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_created
  AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.notify_on_submission();


-- ============================================================
-- PART 4 — STEP 2/3: tutor's review decision cascades everything
-- ============================================================

-- The single entry point for "verify" or "return for revision": the
-- tutor INSERTs one row into `reviews` (append-only, already enforced —
-- no UPDATE/DELETE policy exists on it). This trigger does the rest:
--   verified -> submissions.status='verified' + a verifications row
--              (carries verified_by + verified_at for the green tick)
--   returned -> submissions.status='returned'
-- and notifies the student either way. All of it happens inside the
-- same transaction as the reviews INSERT, so it can't drift out of sync.
CREATE OR REPLACE FUNCTION public.handle_review_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_student UUID;
BEGIN
  SELECT student_id INTO v_student FROM public.submissions WHERE id = NEW.submission_id;

  IF NEW.decision = 'verified' THEN
    UPDATE public.submissions SET status = 'verified' WHERE id = NEW.submission_id;
    INSERT INTO public.verifications (submission_id, verified_by)
    VALUES (NEW.submission_id, NEW.reviewer_id);
    INSERT INTO public.notifications (user_id, type, submission_id)
    VALUES (v_student, 'work_verified', NEW.submission_id);
  ELSIF NEW.decision = 'returned' THEN
    UPDATE public.submissions SET status = 'returned' WHERE id = NEW.submission_id;
    INSERT INTO public.notifications (user_id, type, submission_id)
    VALUES (v_student, 'work_returned', NEW.submission_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_decision
  AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.handle_review_decision();


-- ============================================================
-- PART 5 — STEP 3: resubmission after "returned"
-- ============================================================

-- Resubmitting is a fresh INSERT into `submissions` (a new row), not an
-- edit of the returned one — the old, already-reviewed submission stays
-- exactly as the tutor saw it. This keeps every attempt in the record
-- rather than overwriting history, which matters on a platform where
-- the review trail is a safeguarding log, not just app state.
-- No schema change needed for this — the existing "submissions: student
-- self insert" policy from the previous migration already allows it.
