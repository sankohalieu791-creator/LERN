-- Workshops: online or in-person. Run in the Supabase SQL Editor.
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS mode TEXT CHECK (mode IN ('online','in_person'));
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS location TEXT;
