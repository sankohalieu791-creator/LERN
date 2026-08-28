-- Let staff revoke/withdraw a brief, course, or workshop they sent out.
-- Deliberately NOT a delete: work_items cascades to enrolments/
-- submissions/reviews/verifications, so a hard delete would silently
-- destroy a student's already-verified work history. "Revoke" instead
-- just stops it from being offered to students going forward — same
-- pattern already used for ending a live session (ended_at).
--
-- No new RLS policy needed: "work_items: staff update" (already live)
-- covers this column same as any other.
--
-- Run in the Supabase SQL Editor.

ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
