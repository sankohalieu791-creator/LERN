-- Experience entries used to be just a title + an optional organisation
-- -- "it needs more details than that" (direct feedback). Adds the
-- fields the student-facing form now collects. IF NOT EXISTS everywhere
-- so this is safe to run even if `description` already exists from an
-- earlier, untracked change to this table.
ALTER TABLE public.experience_entries
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text;
