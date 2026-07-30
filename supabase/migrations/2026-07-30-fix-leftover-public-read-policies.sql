-- Follow-up to 2026-07-30-require-auth-for-content-reads.sql.
-- After running that migration, anonymous reads were still succeeding —
-- meaning a leftover permissive policy (qual = true) is still sitting on
-- at least one of these tables under a name the earlier DROP POLICY
-- IF EXISTS didn't match. Postgres OR's multiple permissive SELECT
-- policies together, so any wide-open policy silently defeats the
-- auth.uid() IS NOT NULL one alongside it.
--
-- This dynamically finds and drops every SELECT policy on these tables
-- whose condition is unconditionally true (or has no condition at all),
-- regardless of its name, then re-asserts the authenticated-only policy.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'instructor_applications', 'videos', 'courses',
        'course_sessions', 'workshops', 'video_likes', 'followers',
        'comments', 'course_projects', 'certificates', 'feedback'
      )
      AND cmd IN ('SELECT', 'ALL')
      AND (qual IS NULL OR qual = 'true')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped permissive policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "users: authenticated read" ON public.users;
CREATE POLICY "users: authenticated read" ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "apps: authenticated read" ON public.instructor_applications;
CREATE POLICY "apps: authenticated read" ON public.instructor_applications FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "videos: authenticated read" ON public.videos;
CREATE POLICY "videos: authenticated read" ON public.videos FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "courses: authenticated read" ON public.courses;
CREATE POLICY "courses: authenticated read" ON public.courses FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sessions: authenticated read" ON public.course_sessions;
CREATE POLICY "sessions: authenticated read" ON public.course_sessions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workshops: authenticated read" ON public.workshops;
CREATE POLICY "workshops: authenticated read" ON public.workshops FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "video_likes: authenticated read" ON public.video_likes;
CREATE POLICY "video_likes: authenticated read" ON public.video_likes FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "followers: authenticated read" ON public.followers;
CREATE POLICY "followers: authenticated read" ON public.followers FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comments: authenticated read" ON public.comments;
CREATE POLICY "comments: authenticated read" ON public.comments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "course_projects: authenticated read" ON public.course_projects;
CREATE POLICY "course_projects: authenticated read" ON public.course_projects FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "certificates: authenticated read" ON public.certificates;
CREATE POLICY "certificates: authenticated read" ON public.certificates FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback: authenticated read" ON public.feedback;
CREATE POLICY "feedback: authenticated read" ON public.feedback FOR SELECT USING (auth.uid() IS NOT NULL);

-- Also make sure RLS itself is actually turned on for these tables —
-- if RLS were disabled, policies wouldn't matter at all and every row
-- would be readable regardless of what we just did above.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
