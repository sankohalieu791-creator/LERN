-- ============================================================
-- Make course_id nullable and change FK to ON DELETE SET NULL
-- Run once in Supabase SQL editor to update live DB constraints
-- ============================================================

-- 1) course_projects
ALTER TABLE public.course_projects ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.course_projects
  DROP CONSTRAINT IF EXISTS course_projects_course_id_fkey;
ALTER TABLE public.course_projects
  ADD CONSTRAINT course_projects_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

-- 2) project_submissions
ALTER TABLE public.project_submissions ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.project_submissions
  DROP CONSTRAINT IF EXISTS project_submissions_course_id_fkey;
ALTER TABLE public.project_submissions
  ADD CONSTRAINT project_submissions_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

-- Note: run in Supabase SQL editor. Backup DB before running.
