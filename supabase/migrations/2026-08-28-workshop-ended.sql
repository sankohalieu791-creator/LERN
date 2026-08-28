-- Workshops: track when a session has actually ended, so the card can
-- show "Ended" instead of still inviting people to start/join.
-- Run in the Supabase SQL Editor.
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
