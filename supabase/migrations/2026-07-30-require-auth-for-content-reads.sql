-- Safeguarding fix: the feed, profiles, and related content were readable
-- by anyone on the internet with zero authentication (RLS policies used
-- `USING (true)`, i.e. public read, on every content table). For a platform
-- with under-18 users, that's a real exposure — names, videos, and content
-- must not be visible to a logged-out stranger.
--
-- This tightens every public-read policy found in schema.sql to require an
-- active Supabase session (auth.uid() IS NOT NULL). Combined with the
-- client-side redirect-to-login gate (components/AuthGate.tsx), this means
-- both the UI and the database itself refuse to serve this data to anyone
-- who isn't logged in — closing the hole even for someone bypassing the
-- app UI and querying the API directly.

DROP POLICY IF EXISTS "users: public read" ON public.users;
CREATE POLICY "users: authenticated read" ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "apps: public read" ON public.instructor_applications;
CREATE POLICY "apps: authenticated read" ON public.instructor_applications FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "videos: public read" ON public.videos;
CREATE POLICY "videos: authenticated read" ON public.videos FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "courses: public read" ON public.courses;
CREATE POLICY "courses: authenticated read" ON public.courses FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sessions: public read" ON public.course_sessions;
CREATE POLICY "sessions: authenticated read" ON public.course_sessions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workshops: public read" ON public.workshops;
CREATE POLICY "workshops: authenticated read" ON public.workshops FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "video_likes: public read" ON public.video_likes;
CREATE POLICY "video_likes: authenticated read" ON public.video_likes FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "followers: public read" ON public.followers;
CREATE POLICY "followers: authenticated read" ON public.followers FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comments: public read" ON public.comments;
CREATE POLICY "comments: authenticated read" ON public.comments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "course_projects: public read" ON public.course_projects;
CREATE POLICY "course_projects: authenticated read" ON public.course_projects FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates: public read" ON public.certificates;
CREATE POLICY "certificates: authenticated read" ON public.certificates FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback: public read" ON public.feedback;
CREATE POLICY "feedback: authenticated read" ON public.feedback FOR SELECT USING (auth.uid() IS NOT NULL);
