-- Settings (account, GDPR, theme, notification prefs, org admin) and
-- Reporting. Run in the Supabase SQL Editor.

-- ── Theme + notification preferences ──
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'system'
  CHECK (theme_preference IN ('light','dark','system'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT
  '{"work_submitted":true,"work_verified":true,"employer_interest":true,"reports":true}'::jsonb;

-- ── GDPR: delete my own account and everything attached to it ──
-- A plain client can't DELETE its own auth.users row (that needs admin
-- privileges); this SECURITY DEFINER function is the only legitimate
-- path, and it only ever touches auth.uid()'s own row. public.users has
-- ON DELETE CASCADE back to auth.users, and everything else (submissions,
-- reviews, posts, reactions, attendance, verifications...) cascades from
-- there, so this genuinely deletes everything, not just the login.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- ── Organisation profile: name + safeguarding lead, staff-editable ──
DROP POLICY IF EXISTS "organisations: staff update own org" ON public.organisations;
CREATE POLICY "organisations: staff update own org" ON public.organisations FOR UPDATE
  USING (id = public.current_user_org() AND public.current_user_role() IN ('institution_staff','provider_staff'));

-- Changing the safeguarding lead has to land on a real member of staff in
-- the same org -- a plain UPDATE could otherwise point it at anyone's id.
CREATE OR REPLACE FUNCTION public.check_safeguarding_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.safeguarding_lead_id IS DISTINCT FROM OLD.safeguarding_lead_id AND NEW.safeguarding_lead_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = NEW.safeguarding_lead_id AND u.organisation_id = NEW.id
        AND u.role IN ('institution_staff','provider_staff')
    ) THEN
      RAISE EXCEPTION 'Safeguarding lead must be a member of staff in this organisation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organisations_safeguarding_lead_check ON public.organisations;
CREATE TRIGGER organisations_safeguarding_lead_check BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.check_safeguarding_lead();

-- ── Reports: content or a person, auto-hidden pending review, human decides ──
CREATE TABLE IF NOT EXISTS public.reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  target_type    TEXT NOT NULL CHECK (target_type IN ('post','user','submission','general')),
  target_id      UUID,
  reason         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  reviewed_by    UUID REFERENCES public.users(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_org_status ON public.reports(organisation_id, status);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporting about an adult at LERN (not a student/org matter) has no
-- organisation_id -- it's routed to the independent route, not a
-- safeguarding lead, so no org staff should see it via the normal path.
DROP POLICY IF EXISTS "reports: self insert" ON public.reports;
CREATE POLICY "reports: self insert" ON public.reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "reports: reporter or org safeguarding lead read" ON public.reports;
CREATE POLICY "reports: reporter or org safeguarding lead read" ON public.reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR (
      organisation_id = public.current_user_org()
      AND public.current_user_role() IN ('institution_staff','provider_staff')
    )
  );
DROP POLICY IF EXISTS "reports: org staff update" ON public.reports;
CREATE POLICY "reports: org staff update" ON public.reports FOR UPDATE
  USING (organisation_id = public.current_user_org() AND public.current_user_role() IN ('institution_staff','provider_staff'));

-- Auto-hide: a post with a pending report against it drops out of
-- everyone's feed except the reporter and org staff, until reviewed.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.auto_hide_reported_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    UPDATE public.posts SET hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reports_auto_hide_post ON public.reports;
CREATE TRIGGER reports_auto_hide_post AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_hide_reported_post();

DROP POLICY IF EXISTS "posts: org or public read" ON public.posts;
CREATE POLICY "posts: org or public read" ON public.posts FOR SELECT
  USING (
    (visibility = 'public' OR organisation_id = public.current_user_org())
    AND (
      hidden = false
      OR author_id = auth.uid()
      OR (public.current_user_role() IN ('institution_staff','provider_staff') AND organisation_id = public.current_user_org())
    )
  );

-- A human clearing a report un-hides the post again.
CREATE OR REPLACE FUNCTION public.resolve_report_unhide()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'dismissed' AND OLD.status = 'pending' AND NEW.target_type = 'post' THEN
    UPDATE public.posts SET hidden = false WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reports_resolve_unhide ON public.reports;
CREATE TRIGGER reports_resolve_unhide AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.resolve_report_unhide();
