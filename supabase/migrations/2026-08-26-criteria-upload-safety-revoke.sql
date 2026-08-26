-- ============================================================
-- LERN v2 — verify loop strengthening: A (criteria), B (upload
-- safety), C (revoke a verification).
--
-- D (authenticity), E (overdue reviews), F (resubmission limits) are
-- deliberately NOT built here — noted for later per the spec ("start
-- light, strengthen later"). Worth remembering when they come up:
--   D: no tooling yet, tutor judgement only for now.
--   E: no "awaiting review for X days" flag or escalation yet.
--   F: resubmission is currently unlimited (no cap exists anywhere in
--      the schema) — that's the de facto answer to "decide," but it's
--      an absence of a rule, not a considered one. Flag if you want a
--      cap instead.
--
-- Run this after 2026-08-26-share-visibility-and-fixes.sql.
-- ============================================================


-- ============================================================
-- A — Verification criteria
-- ============================================================

-- NOT NULL, no default: work_items is empty right now (pre-launch,
-- test data only), so there's nothing to backfill. Every brief/course
-- created from here on must state what it's checking work against —
-- already visible to students via the existing work_items SELECT
-- policy, no RLS change needed.
ALTER TABLE public.work_items ADD COLUMN criteria TEXT NOT NULL DEFAULT '';
ALTER TABLE public.work_items ALTER COLUMN criteria DROP DEFAULT;


-- ============================================================
-- B — Upload safety
-- ============================================================

-- File metadata on the submission itself, for display/audit — the
-- real gate is the storage bucket config below (size limit + allowed
-- MIME types), which Postgres/Supabase enforce at upload time, not
-- something a client can bypass by lying about the file's own fields.
ALTER TABLE public.submissions ADD COLUMN file_type TEXT;
ALTER TABLE public.submissions ADD COLUMN file_size_bytes BIGINT;
ALTER TABLE public.submissions ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'clear'
  CHECK (moderation_status IN ('clear','flagged','hidden'));
ALTER TABLE public.submissions ADD COLUMN flagged_reason TEXT;

-- Storage bucket for submitted files. 25MB cap, and an allow-list of
-- the file types the spec calls out (documents, images, common
-- project files) — anything else is rejected by Supabase Storage
-- itself at upload time, before it ever reaches the bucket.
-- NOTE: this does not scan file *contents* for malware — Supabase has
-- no built-in virus/malware scanning. That needs a separate service
-- (e.g. an edge function calling ClamAV or a scanning API) wired in
-- once the actual upload UI is built. Flagging this now so it isn't
-- silently assumed to be covered.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-files', 'submission-files', FALSE, 26214400,
  ARRAY[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: student uploads/reads their own folder (path prefixed
-- {student_id}/...); their own org's staff can also read, matching
-- who can already read the submissions row that references the file.
DROP POLICY IF EXISTS "submission-files: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "submission-files: owner read"   ON storage.objects;
DROP POLICY IF EXISTS "submission-files: org staff read" ON storage.objects;

CREATE POLICY "submission-files: owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'submission-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "submission-files: owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'submission-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "submission-files: org staff read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.work_items wi ON wi.id = s.work_item_id
      WHERE s.student_id::text = (storage.foldername(name))[1]
        AND wi.organisation_id = public.current_user_org()
    )
  );

-- Moderation: org staff can flag/hide/clear a submission (human review
-- of uploaded content) — but NOT touch `status`, which stays reachable
-- only through the review-decision cascade. This is the same
-- depth-based guard used for the tamper protections elsewhere: the
-- cascade's own internal UPDATE runs nested inside the reviews-insert
-- trigger (depth > 1); a client's direct UPDATE is always depth 1.
CREATE POLICY "submissions: org staff moderate" ON public.submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );

-- Two separate things being guarded here:
--  - status: only the internal review-decision cascade may change it
--    (nested inside the reviews-insert trigger, depth > 1) — same
--    pattern as before.
--  - everything except moderation_status/flagged_reason: a direct
--    client UPDATE (depth <= 1, i.e. not the cascade) may only touch
--    the two moderation columns. Staff reviewing uploads should be
--    able to flag/hide/clear content, not silently rewrite a
--    student's actual submitted work — "the submission is the
--    student's work; the student owns it" has to hold even against
--    the org's own staff.
CREATE OR REPLACE FUNCTION public.guard_submission_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'submissions.status can only change via a review decision';
  END IF;

  IF pg_trigger_depth() <= 1 AND (
    NEW.student_id      IS DISTINCT FROM OLD.student_id OR
    NEW.work_item_id    IS DISTINCT FROM OLD.work_item_id OR
    NEW.content          IS DISTINCT FROM OLD.content OR
    NEW.file_type        IS DISTINCT FROM OLD.file_type OR
    NEW.file_size_bytes  IS DISTINCT FROM OLD.file_size_bytes OR
    NEW.submitted_at     IS DISTINCT FROM OLD.submitted_at
  ) THEN
    RAISE EXCEPTION 'Only moderation_status/flagged_reason can be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_submission_status
  BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.guard_submission_status_change();

-- (The org-wide/public sharing policies are rewritten once, at the end
-- of section C below, combining the moderation_status='clear' check
-- added here with the revoked_at IS NULL check revoke needs — no point
-- creating them twice in one file.)

-- Can't verify something still under moderation review — pairs the
-- flag with the gate that matters (the tutor can't wave through
-- content that hasn't been cleared).
CREATE OR REPLACE FUNCTION public.check_moderation_before_verify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_mod TEXT;
BEGIN
  IF NEW.decision = 'verified' THEN
    SELECT moderation_status INTO v_mod FROM public.submissions WHERE id = NEW.submission_id;
    IF v_mod <> 'clear' THEN
      RAISE EXCEPTION 'Cannot verify a submission flagged for moderation review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_verify_requires_clear_moderation
  BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.check_moderation_before_verify();


-- ============================================================
-- C — Revoke a verification
-- ============================================================

-- The reviews table itself needs no schema change to support this —
-- 'revoked' becomes a third valid decision, logged exactly like
-- 'verified'/'returned' (append-only, same as always).
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_decision_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_decision_check
  CHECK (decision IN ('verified','returned','revoked'));
-- A revocation must always carry a reason.
ALTER TABLE public.reviews ADD CONSTRAINT reviews_revoke_needs_feedback
  CHECK (decision <> 'revoked' OR feedback IS NOT NULL);

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('submitted','returned','verified','revoked'));

-- verifications rows are never deleted or overwritten on revoke either
-- — same append-only spirit as reviews, even though the spec only
-- states it explicitly for the reviews table. Revoking marks the
-- existing row (who revoked it, when, why) rather than erasing who
-- verified it and when. "Currently verified" becomes "has a
-- verifications row with revoked_at IS NULL", not "a verifications
-- row exists".
ALTER TABLE public.verifications ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE public.verifications ADD COLUMN revoked_by UUID REFERENCES public.users(id);
ALTER TABLE public.verifications ADD COLUMN revocation_reason TEXT;

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

  ELSIF NEW.decision = 'revoked' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.verifications
      WHERE submission_id = NEW.submission_id AND revoked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot revoke — no active verification exists for this submission';
    END IF;
    UPDATE public.submissions SET status = 'revoked' WHERE id = NEW.submission_id;
    UPDATE public.verifications
      SET revoked_at = NEW.created_at, revoked_by = NEW.reviewer_id, revocation_reason = NEW.feedback
      WHERE submission_id = NEW.submission_id AND revoked_at IS NULL;
    INSERT INTO public.notifications (user_id, type, submission_id)
    VALUES (v_student, 'work_revoked', NEW.submission_id);
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('submission_received','work_returned','work_verified','work_revoked'));

-- A revoked verification stops counting for the employer's "has this
-- student been verified" check, and drops out of org-wide/public
-- sharing immediately — revoking is a real access change, not a
-- cosmetic profile edit the frontend has to remember to hide.
CREATE OR REPLACE FUNCTION public.has_verification(p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.submissions s ON s.id = v.submission_id
    WHERE s.student_id = p_student_id AND v.revoked_at IS NULL
  )
$$;

DROP POLICY IF EXISTS "verifications: org-wide or public read by share visibility" ON public.verifications;
CREATE POLICY "verifications: org-wide or public read by share visibility" ON public.verifications FOR SELECT
  USING (
    revoked_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.moderation_status = 'clear'
      AND (
        visibility = 'public'
        OR (visibility = 'organisation' AND EXISTS (
              SELECT 1 FROM public.users u WHERE u.id = s.student_id AND u.organisation_id = public.current_user_org()
            ))
      )
    )
  );

DROP POLICY IF EXISTS "submissions: org-wide or public read by share visibility" ON public.submissions;
CREATE POLICY "submissions: org-wide or public read by share visibility" ON public.submissions FOR SELECT
  USING (
    moderation_status = 'clear'
    AND EXISTS (
      SELECT 1 FROM public.verifications v
      WHERE v.submission_id = submissions.id AND v.revoked_at IS NULL
        AND (
          v.visibility = 'public'
          OR (v.visibility = 'organisation' AND EXISTS (
                SELECT 1 FROM public.users u WHERE u.id = submissions.student_id AND u.organisation_id = public.current_user_org()
              ))
        )
    )
  );
