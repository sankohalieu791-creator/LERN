-- ============================================================
-- Project Day showcase — run once in the Supabase SQL editor
-- ============================================================
-- Adds the attachment columns used when a student publishes an
-- accepted project, and makes PRIVATE projects readable by
-- instructors and employers (not just the owner).

-- 1. Attachment columns on the published-project showcase
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- 2. Read policy: public to everyone; private visible to the owner,
--    the course instructor, and any instructor/employer account.
DROP POLICY IF EXISTS "projects: conditional read" ON public.projects;
CREATE POLICY "projects: conditional read" ON public.projects FOR SELECT
USING (
  visibility = 'public'
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.account_type IN ('instructor', 'employer') OR u.is_employer = TRUE)
  )
);
