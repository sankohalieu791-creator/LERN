-- Email notifications: work submitted/verified, employer interest, and
-- reports also send an email, not just an in-app notification.
--
-- Architecture: notifications were already created entirely DB-side (see
-- handle_review_decision() / the submissions-insert trigger in
-- 2026-08-26-verify-loop.sql) -- this adds ONE more trigger on that same
-- notifications table, so every existing notification-creating path gets
-- emailed automatically with no changes needed anywhere else. The trigger
-- calls a Next.js API route via pg_net (Supabase's built-in HTTP-from-
-- Postgres extension) rather than a Database Webhook, since a webhook has
-- to be wired up by hand in the dashboard and this doesn't.
--
-- Requires two things only the account holder can do, neither of which
-- is reachable from SQL:
--   1. Sign up at resend.com (or any provider), get an API key, add it
--      as RESEND_API_KEY in Vercel's project environment variables.
--   2. Add NOTIFY_WEBHOOK_SECRET=0e06afda9bdaccbfdd6ddf86ddb0687c2faab4c798fb59b12e9810bf479fac52
--      alongside it (generated once, matches app/api/notify/route.ts).
-- Until #1 is set, the API route no-ops safely (logs and returns) rather
-- than erroring -- nothing breaks, emails just don't go out yet.
--
-- Run in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Notifications: add the two new event types + a link to a report ──
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('submission_received','work_returned','work_verified','employer_interest','report'));
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE;

-- ── Employer interest -> notify the student's org staff ──
CREATE OR REPLACE FUNCTION public.notify_employer_interest()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type)
  SELECT u.id, 'employer_interest'
  FROM public.users u
  JOIN public.users student ON student.id = NEW.student_id
  WHERE u.organisation_id = student.organisation_id
    AND u.role IN ('institution_staff','provider_staff');
  UPDATE public.interest SET org_notified_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS interest_notify ON public.interest;
CREATE TRIGGER interest_notify AFTER INSERT ON public.interest
  FOR EACH ROW EXECUTE FUNCTION public.notify_employer_interest();

-- ── A report -> notify the org's staff (a "general" report with no org,
-- e.g. a concern about an adult at LERN, has nobody here to notify -- it
-- follows the independent route outside this system entirely) ──
CREATE OR REPLACE FUNCTION public.notify_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organisation_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, report_id)
    SELECT id, 'report', NEW.id
    FROM public.users
    WHERE organisation_id = NEW.organisation_id AND role IN ('institution_staff','provider_staff');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reports_notify ON public.reports;
CREATE TRIGGER reports_notify AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report();

-- ── The actual email dispatch: every new notification calls the API route ──
CREATE OR REPLACE FUNCTION public.notify_email_dispatch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lernapp.uk/api/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', '0e06afda9bdaccbfdd6ddf86ddb0687c2faab4c798fb59b12e9810bf479fac52'
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_email_dispatch ON public.notifications;
CREATE TRIGGER notifications_email_dispatch AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_email_dispatch();
