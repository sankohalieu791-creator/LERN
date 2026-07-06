-- ============================================================
-- Add `is_deleted` to `courses` (soft-delete flag)
-- Run once in the Supabase SQL editor or via your migration tooling
-- ============================================================

-- Add column with default FALSE (not null)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: set is_deleted = FALSE for existing rows (safe no-op)
UPDATE public.courses SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- No-op rollback (keep for manual reference):
-- ALTER TABLE public.courses DROP COLUMN IF EXISTS is_deleted;
