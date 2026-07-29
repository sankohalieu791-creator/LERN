-- Phase 1 foundations: date of birth, skills, terms acceptance,
-- profile view log, and org-routed request tracking.
-- Safe to re-run: every statement is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- users: birthdate + skills + terms acceptance
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- profile view log — table already exists live (profile_id, viewer_id,
-- viewed_at), just wasn't indexed, RLS-enabled, or wired into the app yet.
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON public.profile_views(profile_id);
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_views: owner read" ON public.profile_views;
DROP POLICY IF EXISTS "profile_views: authenticated insert" ON public.profile_views;
CREATE POLICY "profile_views: owner read" ON public.profile_views FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "profile_views: authenticated insert" ON public.profile_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- training_requests: who the interest is actually about, when routed
-- through an organisation admin instead of straight to the person
ALTER TABLE public.training_requests ADD COLUMN IF NOT EXISTS about_user_id UUID REFERENCES public.users(id);
