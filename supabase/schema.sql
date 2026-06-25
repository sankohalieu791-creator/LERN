-- ============================================================
-- LERN APP — COMPLETE SUPABASE SCHEMA  (v3)
-- Paste into Supabase SQL Editor → Run.
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- TABLES
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                  TEXT NOT NULL UNIQUE,
  username               TEXT NOT NULL UNIQUE,
  avatar_url             TEXT,
  bio                    TEXT,
  title                  TEXT,
  work_description       TEXT,
  phone_number           TEXT,
  account_type           TEXT NOT NULL DEFAULT 'student'
                           CHECK (account_type IN ('student','instructor','employer')),
  is_instructor          BOOLEAN NOT NULL DEFAULT FALSE,
  is_employer            BOOLEAN NOT NULL DEFAULT FALSE,
  verified               BOOLEAN NOT NULL DEFAULT FALSE,
  followers_count        INTEGER NOT NULL DEFAULT 0,
  following_count        INTEGER NOT NULL DEFAULT 0,
  views_count            INTEGER NOT NULL DEFAULT 0,
  dark_mode              BOOLEAN NOT NULL DEFAULT TRUE,
  notif_push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  notif_email_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_course_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  instructor_role        TEXT CHECK (instructor_role IN ('mentor','professor','teacher','coach')),
  experience_years       INTEGER,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions for existing databases
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_push_enabled     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_email_enabled    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notif_course_reminders BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS instructor_role        TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS experience_years       INTEGER;


-- ── INSTRUCTOR APPLICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instructor_applications (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name        TEXT NOT NULL,
  topic            TEXT NOT NULL,
  bio              TEXT NOT NULL,
  role_type        TEXT CHECK (role_type IN ('mentor','professor','teacher','coach')),
  location         TEXT,
  experience_years INTEGER,
  contact_email    TEXT,
  contact_phone    TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions for existing instructor_applications
ALTER TABLE public.instructor_applications ADD COLUMN IF NOT EXISTS role_type        TEXT;
ALTER TABLE public.instructor_applications ADD COLUMN IF NOT EXISTS location         TEXT;
ALTER TABLE public.instructor_applications ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE public.instructor_applications ADD COLUMN IF NOT EXISTS contact_email    TEXT;
ALTER TABLE public.instructor_applications ADD COLUMN IF NOT EXISTS contact_phone    TEXT;


-- ── VIDEOS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.videos (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  thumbnail_url  TEXT,
  video_url      TEXT,
  duration       TEXT NOT NULL DEFAULT '0:00',
  subject        TEXT NOT NULL,
  views          INTEGER NOT NULL DEFAULT 0,
  likes_count    INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_live        BOOLEAN NOT NULL DEFAULT FALSE,
  stream_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COURSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instructor_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  thumbnail_url  TEXT,
  subject        TEXT NOT NULL,
  level          TEXT NOT NULL DEFAULT 'beginner'
                   CHECK (level IN ('beginner','intermediate','advanced')),
  duration_weeks INTEGER NOT NULL DEFAULT 0,
  rating         DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COURSE SESSIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_sessions (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id      UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  session_number INTEGER NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  session_date   DATE,
  session_time   TIME,
  is_live        BOOLEAN NOT NULL DEFAULT FALSE,
  is_project_day BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WORKSHOPS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workshops (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instructor_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  thumbnail_url    TEXT,
  workshop_date    DATE NOT NULL,
  workshop_time    TIME NOT NULL,
  location         TEXT NOT NULL DEFAULT 'Online',
  is_online        BOOLEAN NOT NULL DEFAULT TRUE,
  max_participants INTEGER NOT NULL DEFAULT 30,
  enrolled_count   INTEGER NOT NULL DEFAULT 0,
  is_live          BOOLEAN NOT NULL DEFAULT FALSE,
  stream_url       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ENROLLMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id),
  UNIQUE (user_id, workshop_id),
  CHECK (course_id IS NOT NULL OR workshop_id IS NOT NULL)
);

-- ── VIDEO LIKES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.video_likes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id   UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, user_id)
);

-- ── FOLLOWERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.followers (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ── COMMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id   UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROJECTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  course_id   UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  visibility  TEXT NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('private','public')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROJECT SUBMISSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_submissions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  submission_text     TEXT,
  attachment_url      TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','needs_work')),
  instructor_feedback TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CERTIFICATES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  issuer          TEXT NOT NULL,
  year            INTEGER NOT NULL,
  certificate_url TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('like','comment','follow')),
  related_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  video_id        UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FEEDBACK ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_user_id, reviewer_id)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_videos_user_id           ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at        ON public.videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_subject           ON public.videos(subject);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id    ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_subject          ON public.courses(subject);
CREATE INDEX IF NOT EXISTS idx_courses_level            ON public.courses(level);
CREATE INDEX IF NOT EXISTS idx_sessions_course_id       ON public.course_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_number          ON public.course_sessions(course_id, session_number);
CREATE INDEX IF NOT EXISTS idx_workshops_instructor_id  ON public.workshops(instructor_id);
CREATE INDEX IF NOT EXISTS idx_workshops_date           ON public.workshops(workshop_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id      ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id    ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_workshop_id  ON public.enrollments(workshop_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id     ON public.video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_id      ON public.video_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower_id    ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id   ON public.followers(following_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id        ON public.comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id         ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created         ON public.comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_id         ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_course_id       ON public.projects(course_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility      ON public.projects(visibility);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_feedback_profile         ON public.feedback(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id     ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_apps_user_id  ON public.instructor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_apps_status   ON public.instructor_applications(status);
CREATE INDEX IF NOT EXISTS idx_instructor_apps_role     ON public.instructor_applications(role_type);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- 1. Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, username, account_type)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Like counts
CREATE OR REPLACE FUNCTION public.increment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id; RETURN NEW; END;$$;

CREATE OR REPLACE FUNCTION public.decrement_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.videos SET likes_count = GREATEST(likes_count-1,0) WHERE id = OLD.video_id; RETURN OLD; END;$$;

DROP TRIGGER IF EXISTS on_like_added   ON public.video_likes;
DROP TRIGGER IF EXISTS on_like_removed ON public.video_likes;
CREATE TRIGGER on_like_added   AFTER INSERT ON public.video_likes FOR EACH ROW EXECUTE FUNCTION public.increment_likes_count();
CREATE TRIGGER on_like_removed AFTER DELETE ON public.video_likes FOR EACH ROW EXECUTE FUNCTION public.decrement_likes_count();


-- 3. Notify on like
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM public.videos WHERE id = NEW.video_id;
  IF v_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, related_user_id, video_id)
    VALUES (v_owner, 'like', NEW.user_id, NEW.video_id);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS on_video_liked ON public.video_likes;
CREATE TRIGGER on_video_liked AFTER INSERT ON public.video_likes FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();


-- 4. Comment counts
CREATE OR REPLACE FUNCTION public.increment_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.videos SET comments_count = comments_count + 1 WHERE id = NEW.video_id; RETURN NEW; END;$$;

CREATE OR REPLACE FUNCTION public.decrement_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.videos SET comments_count = GREATEST(comments_count-1,0) WHERE id = OLD.video_id; RETURN OLD; END;$$;

DROP TRIGGER IF EXISTS on_comment_added   ON public.comments;
DROP TRIGGER IF EXISTS on_comment_removed ON public.comments;
CREATE TRIGGER on_comment_added   AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.increment_comments_count();
CREATE TRIGGER on_comment_removed AFTER DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.decrement_comments_count();


-- 5. Notify on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM public.videos WHERE id = NEW.video_id;
  IF v_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, related_user_id, video_id)
    VALUES (v_owner, 'comment', NEW.user_id, NEW.video_id);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS on_comment_posted ON public.comments;
CREATE TRIGGER on_comment_posted AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();


-- 6. Follower counts
CREATE OR REPLACE FUNCTION public.increment_follower_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  UPDATE public.users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.decrement_follower_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET followers_count = GREATEST(followers_count-1,0) WHERE id = OLD.following_id;
  UPDATE public.users SET following_count = GREATEST(following_count-1,0) WHERE id = OLD.follower_id;
  RETURN OLD;
END;$$;

DROP TRIGGER IF EXISTS on_follow_added   ON public.followers;
DROP TRIGGER IF EXISTS on_follow_removed ON public.followers;
CREATE TRIGGER on_follow_added   AFTER INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.increment_follower_counts();
CREATE TRIGGER on_follow_removed AFTER DELETE ON public.followers FOR EACH ROW EXECUTE FUNCTION public.decrement_follower_counts();


-- 7. Notify on follow
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, related_user_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS on_user_followed ON public.followers;
CREATE TRIGGER on_user_followed AFTER INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();


-- 8. Course enrolled count
CREATE OR REPLACE FUNCTION public.update_course_enrolled_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.course_id IS NOT NULL THEN
    UPDATE public.courses SET enrolled_count = enrolled_count + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' AND OLD.course_id IS NOT NULL THEN
    UPDATE public.courses SET enrolled_count = GREATEST(enrolled_count-1,0) WHERE id = OLD.course_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
DROP TRIGGER IF EXISTS on_course_enrollment ON public.enrollments;
CREATE TRIGGER on_course_enrollment AFTER INSERT OR DELETE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_course_enrolled_count();


-- 9. Workshop enrolled count
CREATE OR REPLACE FUNCTION public.update_workshop_enrolled_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.workshop_id IS NOT NULL THEN
    UPDATE public.workshops SET enrolled_count = enrolled_count + 1 WHERE id = NEW.workshop_id;
  ELSIF TG_OP = 'DELETE' AND OLD.workshop_id IS NOT NULL THEN
    UPDATE public.workshops SET enrolled_count = GREATEST(enrolled_count-1,0) WHERE id = OLD.workshop_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
DROP TRIGGER IF EXISTS on_workshop_enrollment ON public.enrollments;
CREATE TRIGGER on_workshop_enrollment AFTER INSERT OR DELETE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_workshop_enrolled_count();


-- 10. Approve instructor application → grant verified badge + role
CREATE OR REPLACE FUNCTION public.handle_instructor_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    UPDATE public.users
    SET is_instructor    = TRUE,
        account_type     = 'instructor',
        verified         = TRUE,
        instructor_role  = NEW.role_type,
        experience_years = NEW.experience_years
    WHERE id = NEW.user_id;
    UPDATE public.instructor_applications
    SET reviewed_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS on_instructor_approved ON public.instructor_applications;
CREATE TRIGGER on_instructor_approved
  AFTER UPDATE ON public.instructor_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_instructor_approval();


-- 11. Increment video views (callable from client)
CREATE OR REPLACE FUNCTION public.increment_video_views(p_video_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.videos SET views = views + 1 WHERE id = p_video_id; END;$$;

-- 12. Increment profile views (callable from client — bypasses RLS)
CREATE OR REPLACE FUNCTION public.increment_profile_views(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.users SET views_count = views_count + 1 WHERE id = p_user_id; END;$$;

-- 13. Mark all notifications read
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.notifications SET read = TRUE WHERE user_id = p_user_id AND read = FALSE; END;$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback                ENABLE ROW LEVEL SECURITY;


-- USERS
DROP POLICY IF EXISTS "users: public read" ON public.users;
DROP POLICY IF EXISTS "users: insert own"  ON public.users;
DROP POLICY IF EXISTS "users: update own"  ON public.users;
DROP POLICY IF EXISTS "users: delete own"  ON public.users;
CREATE POLICY "users: public read" ON public.users FOR SELECT USING (true);
CREATE POLICY "users: insert own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users: update own"  ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users: delete own"  ON public.users FOR DELETE USING (auth.uid() = id);


-- INSTRUCTOR APPLICATIONS
-- Public read so Discover page can show all applications
DROP POLICY IF EXISTS "apps: public read"   ON public.instructor_applications;
DROP POLICY IF EXISTS "apps: owner read"    ON public.instructor_applications;
DROP POLICY IF EXISTS "apps: owner insert"  ON public.instructor_applications;
DROP POLICY IF EXISTS "apps: owner update"  ON public.instructor_applications;
CREATE POLICY "apps: public read"  ON public.instructor_applications FOR SELECT USING (true);
CREATE POLICY "apps: owner insert" ON public.instructor_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "apps: owner update" ON public.instructor_applications FOR UPDATE USING (auth.uid() = user_id);


-- VIDEOS
DROP POLICY IF EXISTS "videos: public read"          ON public.videos;
DROP POLICY IF EXISTS "videos: authenticated insert" ON public.videos;
DROP POLICY IF EXISTS "videos: owner update"         ON public.videos;
DROP POLICY IF EXISTS "videos: owner delete"         ON public.videos;
CREATE POLICY "videos: public read"          ON public.videos FOR SELECT USING (true);
CREATE POLICY "videos: authenticated insert" ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos: owner update"         ON public.videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "videos: owner delete"         ON public.videos FOR DELETE USING (auth.uid() = user_id);


-- COURSES
DROP POLICY IF EXISTS "courses: public read"       ON public.courses;
DROP POLICY IF EXISTS "courses: instructor insert" ON public.courses;
DROP POLICY IF EXISTS "courses: owner update"      ON public.courses;
DROP POLICY IF EXISTS "courses: owner delete"      ON public.courses;
CREATE POLICY "courses: public read"       ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses: instructor insert" ON public.courses FOR INSERT
  WITH CHECK (auth.uid() = instructor_id AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_instructor = TRUE));
CREATE POLICY "courses: owner update" ON public.courses FOR UPDATE USING (auth.uid() = instructor_id);
CREATE POLICY "courses: owner delete" ON public.courses FOR DELETE USING (auth.uid() = instructor_id);


-- COURSE SESSIONS
DROP POLICY IF EXISTS "sessions: public read"         ON public.course_sessions;
DROP POLICY IF EXISTS "sessions: course owner insert" ON public.course_sessions;
DROP POLICY IF EXISTS "sessions: course owner update" ON public.course_sessions;
DROP POLICY IF EXISTS "sessions: course owner delete" ON public.course_sessions;
CREATE POLICY "sessions: public read" ON public.course_sessions FOR SELECT USING (true);
CREATE POLICY "sessions: course owner insert" ON public.course_sessions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));
CREATE POLICY "sessions: course owner update" ON public.course_sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));
CREATE POLICY "sessions: course owner delete" ON public.course_sessions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid()));


-- WORKSHOPS
DROP POLICY IF EXISTS "workshops: public read"       ON public.workshops;
DROP POLICY IF EXISTS "workshops: instructor insert" ON public.workshops;
DROP POLICY IF EXISTS "workshops: owner update"      ON public.workshops;
DROP POLICY IF EXISTS "workshops: owner delete"      ON public.workshops;
CREATE POLICY "workshops: public read"       ON public.workshops FOR SELECT USING (true);
CREATE POLICY "workshops: instructor insert" ON public.workshops FOR INSERT
  WITH CHECK (auth.uid() = instructor_id AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND is_instructor = TRUE));
CREATE POLICY "workshops: owner update" ON public.workshops FOR UPDATE USING (auth.uid() = instructor_id);
CREATE POLICY "workshops: owner delete" ON public.workshops FOR DELETE USING (auth.uid() = instructor_id);


-- ENROLLMENTS
DROP POLICY IF EXISTS "enrollments: owner or instructor read" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: authenticated insert"     ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: owner delete"            ON public.enrollments;
CREATE POLICY "enrollments: owner or instructor read" ON public.enrollments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.courses  WHERE id = enrollments.course_id   AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workshops WHERE id = enrollments.workshop_id AND instructor_id = auth.uid())
  );
CREATE POLICY "enrollments: authenticated insert" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "enrollments: owner delete"         ON public.enrollments FOR DELETE USING (auth.uid() = user_id);


-- VIDEO LIKES
DROP POLICY IF EXISTS "video_likes: public read"          ON public.video_likes;
DROP POLICY IF EXISTS "video_likes: authenticated insert" ON public.video_likes;
DROP POLICY IF EXISTS "video_likes: owner delete"         ON public.video_likes;
CREATE POLICY "video_likes: public read"          ON public.video_likes FOR SELECT USING (true);
CREATE POLICY "video_likes: authenticated insert" ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_likes: owner delete"         ON public.video_likes FOR DELETE USING (auth.uid() = user_id);


-- FOLLOWERS
DROP POLICY IF EXISTS "followers: public read"          ON public.followers;
DROP POLICY IF EXISTS "followers: authenticated insert" ON public.followers;
DROP POLICY IF EXISTS "followers: owner delete"         ON public.followers;
CREATE POLICY "followers: public read"          ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers: authenticated insert" ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "followers: owner delete"         ON public.followers FOR DELETE USING (auth.uid() = follower_id);


-- COMMENTS
DROP POLICY IF EXISTS "comments: public read"          ON public.comments;
DROP POLICY IF EXISTS "comments: authenticated insert" ON public.comments;
DROP POLICY IF EXISTS "comments: owner update"         ON public.comments;
DROP POLICY IF EXISTS "comments: owner delete"         ON public.comments;
CREATE POLICY "comments: public read"          ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments: authenticated insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments: owner update"         ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments: owner delete"         ON public.comments FOR DELETE USING (auth.uid() = user_id);


-- PROJECTS
DROP POLICY IF EXISTS "projects: conditional read"     ON public.projects;
DROP POLICY IF EXISTS "projects: authenticated insert" ON public.projects;
DROP POLICY IF EXISTS "projects: owner update"         ON public.projects;
DROP POLICY IF EXISTS "projects: owner delete"         ON public.projects;
CREATE POLICY "projects: conditional read"     ON public.projects FOR SELECT USING (visibility='public' OR auth.uid()=user_id);
CREATE POLICY "projects: authenticated insert" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: owner update"         ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects: owner delete"         ON public.projects FOR DELETE USING (auth.uid() = user_id);


-- PROJECT SUBMISSIONS
DROP POLICY IF EXISTS "submissions: owner or instructor read"   ON public.project_submissions;
DROP POLICY IF EXISTS "submissions: project owner insert"       ON public.project_submissions;
DROP POLICY IF EXISTS "submissions: owner or instructor update" ON public.project_submissions;
CREATE POLICY "submissions: owner or instructor read" ON public.project_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.user_id = auth.uid() OR p.visibility = 'public'
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p.course_id AND c.instructor_id = auth.uid()))));
CREATE POLICY "submissions: project owner insert" ON public.project_submissions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()));
CREATE POLICY "submissions: owner or instructor update" ON public.project_submissions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p.course_id AND c.instructor_id = auth.uid()))));


-- CERTIFICATES
DROP POLICY IF EXISTS "certificates: public read"  ON public.certificates;
DROP POLICY IF EXISTS "certificates: owner insert" ON public.certificates;
DROP POLICY IF EXISTS "certificates: owner delete" ON public.certificates;
CREATE POLICY "certificates: public read"  ON public.certificates FOR SELECT USING (true);
CREATE POLICY "certificates: owner insert" ON public.certificates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "certificates: owner delete" ON public.certificates FOR DELETE USING (auth.uid() = user_id);


-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications: owner read"    ON public.notifications;
DROP POLICY IF EXISTS "notifications: system insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications: owner update"  ON public.notifications;
DROP POLICY IF EXISTS "notifications: owner delete"  ON public.notifications;
CREATE POLICY "notifications: owner read"    ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications: system insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications: owner update"  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications: owner delete"  ON public.notifications FOR DELETE USING (auth.uid() = user_id);


-- FEEDBACK
DROP POLICY IF EXISTS "feedback: public read"          ON public.feedback;
DROP POLICY IF EXISTS "feedback: authenticated insert" ON public.feedback;
DROP POLICY IF EXISTS "feedback: reviewer delete"      ON public.feedback;
CREATE POLICY "feedback: public read"          ON public.feedback FOR SELECT USING (true);
CREATE POLICY "feedback: authenticated insert" ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id AND auth.uid() != profile_user_id);
CREATE POLICY "feedback: reviewer delete"     ON public.feedback FOR DELETE USING (auth.uid() = reviewer_id);


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars',           'avatars',           TRUE)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('videos',            'videos',            TRUE)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails',        'thumbnails',        TRUE)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('course-thumbnails', 'course-thumbnails', TRUE)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates',      'certificates',      FALSE) ON CONFLICT (id) DO NOTHING;

-- avatars
DROP POLICY IF EXISTS "avatars: public read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner update" ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner delete" ON storage.objects;
CREATE POLICY "avatars: public read"  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars: owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars: owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- videos
DROP POLICY IF EXISTS "videos bucket: public read"          ON storage.objects;
DROP POLICY IF EXISTS "videos bucket: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "videos bucket: owner delete"         ON storage.objects;
CREATE POLICY "videos bucket: public read"          ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "videos bucket: authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
CREATE POLICY "videos bucket: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- thumbnails
DROP POLICY IF EXISTS "thumbnails: public read"          ON storage.objects;
DROP POLICY IF EXISTS "thumbnails: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails: owner delete"         ON storage.objects;
CREATE POLICY "thumbnails: public read"          ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "thumbnails: authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');
CREATE POLICY "thumbnails: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- course-thumbnails
DROP POLICY IF EXISTS "course-thumbnails: public read"          ON storage.objects;
DROP POLICY IF EXISTS "course-thumbnails: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "course-thumbnails: owner delete"         ON storage.objects;
CREATE POLICY "course-thumbnails: public read"          ON storage.objects FOR SELECT USING (bucket_id = 'course-thumbnails');
CREATE POLICY "course-thumbnails: authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'course-thumbnails' AND auth.role() = 'authenticated');
CREATE POLICY "course-thumbnails: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'course-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- certificates (private — owner only)
DROP POLICY IF EXISTS "certificates storage: owner read"   ON storage.objects;
DROP POLICY IF EXISTS "certificates storage: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "certificates storage: owner delete" ON storage.objects;
CREATE POLICY "certificates storage: owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "certificates storage: owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "certificates storage: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- classroom-files (shared within a classroom session — public read, authenticated upload)
INSERT INTO storage.buckets (id, name, public) VALUES ('classroom-files', 'classroom-files', TRUE) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "classroom-files: public read"          ON storage.objects;
DROP POLICY IF EXISTS "classroom-files: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "classroom-files: owner delete"         ON storage.objects;
CREATE POLICY "classroom-files: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'classroom-files');
CREATE POLICY "classroom-files: authenticated upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'classroom-files' AND auth.role() = 'authenticated');
CREATE POLICY "classroom-files: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'classroom-files' AND auth.uid()::text = (storage.foldername(name))[1]);
