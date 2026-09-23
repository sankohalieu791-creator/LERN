-- Work Experience (institutions), Talent Pools automation (employers),
-- Bootcamp Evidence (providers) -- Final Build Spec, 23 Sep 2026.
-- Run in the Supabase SQL Editor, then verify via REST.

-- ════════════════════════════════════════════════════════════════════
-- 1. WORK EXPERIENCE -- placements + placement-scoped attendance.
-- A "year group" is just an existing group (the same class/cohort
-- concept Students > Attendance already uses) -- no new roster concept
-- needed. Institution-only: providers have no Work Experience section.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  student_id      UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  group_id        UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  employer_name   TEXT NOT NULL,
  employer_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  starts_on       DATE NOT NULL,
  ends_on         DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_placements_org ON public.placements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_placements_student ON public.placements(student_id);
CREATE INDEX IF NOT EXISTS idx_placements_group ON public.placements(group_id);
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placements: institution staff read" ON public.placements;
CREATE POLICY "placements: institution staff read" ON public.placements FOR SELECT
  USING (organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff');
DROP POLICY IF EXISTS "placements: institution staff insert" ON public.placements;
CREATE POLICY "placements: institution staff insert" ON public.placements FOR INSERT
  WITH CHECK (
    organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff'
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users s WHERE s.id = student_id AND s.organisation_id = public.current_user_org() AND s.role = 'student')
  );
DROP POLICY IF EXISTS "placements: institution staff update" ON public.placements;
CREATE POLICY "placements: institution staff update" ON public.placements FOR UPDATE
  USING (organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff');
DROP POLICY IF EXISTS "placements: institution staff delete" ON public.placements;
CREATE POLICY "placements: institution staff delete" ON public.placements FOR DELETE
  USING (organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff');

-- Entirely separate from attendance_records (classroom attendance) --
-- scoped to one placement (one employer, one date range), never a group.
CREATE TABLE IF NOT EXISTS public.placement_attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id  UUID REFERENCES public.placements(id) ON DELETE CASCADE NOT NULL,
  session_date  DATE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('present','absent')),
  marked_by     UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_placement_attendance_placement ON public.placement_attendance(placement_id);
ALTER TABLE public.placement_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placement_attendance: institution staff read" ON public.placement_attendance;
CREATE POLICY "placement_attendance: institution staff read" ON public.placement_attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.placements p WHERE p.id = placement_id
    AND p.organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff'
  ));
DROP POLICY IF EXISTS "placement_attendance: institution staff insert" ON public.placement_attendance;
CREATE POLICY "placement_attendance: institution staff insert" ON public.placement_attendance FOR INSERT
  WITH CHECK (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.placements p WHERE p.id = placement_id
      AND p.organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff'
    )
  );
DROP POLICY IF EXISTS "placement_attendance: institution staff update" ON public.placement_attendance;
CREATE POLICY "placement_attendance: institution staff update" ON public.placement_attendance FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.placements p WHERE p.id = placement_id
    AND p.organisation_id = public.current_user_org() AND public.current_user_role() = 'institution_staff'
  ));

-- ════════════════════════════════════════════════════════════════════
-- 2. TALENT POOLS -- fully automatic cadence + "mark role filled" +
-- customisable cadence for Scale/Enterprise. Sending itself happens in
-- an API route on a Vercel Cron schedule (service role, bypasses RLS);
-- this table just records what's already gone out so the cron job
-- never double-sends a stage, and so the UI can show a real log.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.talent_pools ADD COLUMN IF NOT EXISTS role_filled_at TIMESTAMPTZ;
-- null = the fixed default cadence. Scale/Enterprise only (enforced in
-- the API route, not here) -- an array of {day, label, message}.
ALTER TABLE public.talent_pools ADD COLUMN IF NOT EXISTS custom_cadence JSONB;

CREATE TABLE IF NOT EXISTS public.talent_pool_cadence_sends (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID REFERENCES public.talent_pool_members(id) ON DELETE CASCADE NOT NULL,
  stage       INT NOT NULL,
  label       TEXT NOT NULL,
  message     TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_cadence_sends_member ON public.talent_pool_cadence_sends(member_id);
ALTER TABLE public.talent_pool_cadence_sends ENABLE ROW LEVEL SECURITY;

-- Read-only for the owning employer -- every write goes through the
-- Vercel Cron route's service-role client, never a direct client
-- insert, guarded by the (member_id, stage) unique constraint so a
-- stage can never be logged, or sent, twice.
DROP POLICY IF EXISTS "cadence sends: owning employer read" ON public.talent_pool_cadence_sends;
CREATE POLICY "cadence sends: owning employer read" ON public.talent_pool_cadence_sends FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.talent_pool_members m
    JOIN public.talent_pools p ON p.id = m.pool_id
    WHERE m.id = member_id AND p.employer_id = auth.uid()
  ));

-- ════════════════════════════════════════════════════════════════════
-- 3. BOOTCAMP EVIDENCE -- a summary RPC over data already entered
-- elsewhere (Workshops/Students attendance, Review, Job tracking). No
-- new schema: a "cohort" is a course (work_items.type = 'course') with
-- a group assigned; learners are that group's members.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_bootcamp_evidence(p_organisation_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT (
    public.current_user_role() = 'provider_staff' AND p_organisation_id = public.current_user_org()
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(json_agg(cohort ORDER BY cohort->>'title'), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'work_item_id', wi.id,
      'title', wi.title,
      'group_id', wi.group_id,
      'group_name', g.name,
      'learners', (
        SELECT COALESCE(json_agg(json_build_object(
          'student_id', u.id,
          'full_name', u.full_name,
          'attendance_days', (
            SELECT count(*) FROM public.attendance_records ar
            WHERE ar.group_id = wi.group_id AND ar.student_id = u.id AND ar.status = 'present'
          ),
          'completed', EXISTS (
            SELECT 1 FROM public.submissions sub
            WHERE sub.work_item_id = wi.id AND sub.student_id = u.id AND sub.status = 'verified'
          ),
          'interview_stage', (
            SELECT a.stage FROM public.applications a
            WHERE a.student_id = u.id AND a.organisation_id = p_organisation_id
            ORDER BY a.stage_updated_at DESC LIMIT 1
          ),
          'interview_date', (
            SELECT a.stage_updated_at FROM public.applications a
            WHERE a.student_id = u.id AND a.organisation_id = p_organisation_id
            ORDER BY a.stage_updated_at DESC LIMIT 1
          )
        ) ORDER BY u.full_name), '[]'::json)
        FROM public.users u WHERE u.group_id = wi.group_id AND u.role = 'student'
      )
    ) AS cohort
    FROM public.work_items wi
    LEFT JOIN public.groups g ON g.id = wi.group_id
    WHERE wi.organisation_id = p_organisation_id AND wi.type = 'course' AND wi.group_id IS NOT NULL
  ) sub;

  RETURN v_result;
END;
$$;
