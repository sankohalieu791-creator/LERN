-- Groups/classes, a proper Briefs form (topic/assignment/deadline/group
-- assignment/attachments), real file upload on submissions, and the
-- attendance register. Run in the Supabase SQL Editor, then verify via REST.

-- ── Join codes: track usage so the Dashboard can flag heavily-used ones ──
ALTER TABLE public.join_codes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

-- Same as before, plus incrementing used_count so the Dashboard can flag
-- a heavily-used code (the rest of the function is unchanged).
CREATE OR REPLACE FUNCTION public.redeem_join_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_code_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND organisation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already belong to an organisation';
  END IF;

  SELECT id, organisation_id INTO v_code_id, v_org
  FROM public.join_codes
  WHERE code = p_code
    AND revoked = FALSE
    AND (expires_at IS NULL OR expires_at > now());

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired join code';
  END IF;

  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users SET organisation_id = v_org WHERE id = auth.uid();
  UPDATE public.join_codes SET used_count = used_count + 1 WHERE id = v_code_id;
  RETURN v_org;
END;
$$;

-- ── Groups (classes) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_groups_org ON public.groups(organisation_id);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups: org read" ON public.groups;
CREATE POLICY "groups: org read" ON public.groups FOR SELECT
  USING (organisation_id = public.current_user_org());
DROP POLICY IF EXISTS "groups: org staff write" ON public.groups;
CREATE POLICY "groups: org staff write" ON public.groups FOR INSERT
  WITH CHECK (organisation_id = public.current_user_org() AND public.current_user_role() IN ('institution_staff','provider_staff'));
DROP POLICY IF EXISTS "groups: org staff update" ON public.groups;
CREATE POLICY "groups: org staff update" ON public.groups FOR UPDATE
  USING (organisation_id = public.current_user_org() AND public.current_user_role() IN ('institution_staff','provider_staff'));

-- A student belongs to at most one group at a time -- matches "assign to a
-- whole class or group" and the Students filter-by-group requirement.
-- Nullable: joining an org doesn't require a group yet.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- group_id needs the same tamper guard as role/organisation_id/date_of_birth
-- -- otherwise a student could just PATCH their own row into any group in
-- their org. Extends the existing trigger function (same internal_org_join
-- bypass flag) rather than adding a second trigger.
CREATE OR REPLACE FUNCTION public.prevent_self_role_org_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.id THEN
    IF current_setting('app.internal_org_join', true) = 'true' THEN
      RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
      RAISE EXCEPTION 'Cannot change your own organisation';
    END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      RAISE EXCEPTION 'Cannot change your own date of birth — contact your organisation to correct it';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'Cannot change your own group — contact your organisation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Staff assigning a student to a group is the same class of action as
-- assigning an organisation -- goes through the same tamper-guard-bypass
-- pattern already used by redeem_join_code/create_organisation_and_join.
CREATE OR REPLACE FUNCTION public.set_student_group(p_student_id UUID, p_group_id UUID)
RETURNS VOID AS $$
DECLARE
  v_org UUID;
BEGIN
  IF public.current_user_role() NOT IN ('institution_staff','provider_staff') THEN
    RAISE EXCEPTION 'Only org staff can assign a student to a group';
  END IF;
  SELECT organisation_id INTO v_org FROM public.groups WHERE id = p_group_id;
  IF v_org IS NULL OR v_org <> public.current_user_org() THEN
    RAISE EXCEPTION 'Group not found in your organisation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_student_id AND organisation_id = public.current_user_org() AND role = 'student') THEN
    RAISE EXCEPTION 'Student not found in your organisation';
  END IF;
  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users SET group_id = p_group_id WHERE id = p_student_id;
  PERFORM set_config('app.internal_org_join', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Briefs, properly: topic, assignment text, deadline, group targeting ──
-- (must come before the work_items RLS policy below, which reads group_id)
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS assignment TEXT;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- A work_item assigned to a specific group should only be visible to
-- students in that group -- staff still see everything in their org
-- regardless of group, since they manage all of it.
DROP POLICY IF EXISTS "work_items: org member read" ON public.work_items;
CREATE POLICY "work_items: org member read" ON public.work_items FOR SELECT
  USING (
    visibility = 'public'
    OR (organisation_id = public.current_user_org() AND public.current_user_role() IN ('institution_staff','provider_staff'))
    OR (
      organisation_id = public.current_user_org()
      AND public.current_user_role() = 'student'
      AND (group_id IS NULL OR group_id = (SELECT group_id FROM public.users WHERE id = auth.uid()))
    )
  );

-- ── Brief attachments (slides, docs, resources the tutor attaches) ──
CREATE TABLE IF NOT EXISTS public.work_item_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id  UUID REFERENCES public.work_items(id) ON DELETE CASCADE NOT NULL,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wia_work_item ON public.work_item_attachments(work_item_id);
ALTER TABLE public.work_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_item_attachments: org read" ON public.work_item_attachments;
CREATE POLICY "work_item_attachments: org read" ON public.work_item_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()));
DROP POLICY IF EXISTS "work_item_attachments: org staff insert" ON public.work_item_attachments;
CREATE POLICY "work_item_attachments: org staff insert" ON public.work_item_attachments FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org())
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('work-item-attachments', 'work-item-attachments', FALSE, 26214400,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword','text/plain'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "work-item-attachments: org staff upload" ON storage.objects;
CREATE POLICY "work-item-attachments: org staff upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'work-item-attachments' AND public.current_user_role() IN ('institution_staff','provider_staff'));
DROP POLICY IF EXISTS "work-item-attachments: org read" ON storage.objects;
CREATE POLICY "work-item-attachments: org read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'work-item-attachments'
    AND EXISTS (
      SELECT 1 FROM public.work_item_attachments wia
      JOIN public.work_items wi ON wi.id = wia.work_item_id
      WHERE wia.file_path = storage.objects.name AND wi.organisation_id = public.current_user_org()
    )
  );

-- Staff uploading "existing work" on a student's behalf needs to write
-- into that student's submission-files folder, not their own -- the
-- existing owner-upload policy only allows auth.uid()'s own folder.
DROP POLICY IF EXISTS "submission-files: org staff upload for student" ON storage.objects;
CREATE POLICY "submission-files: org staff upload for student" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submission-files'
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = (storage.foldername(name))[1]
        AND u.organisation_id = public.current_user_org() AND u.role = 'student'
    )
  );

-- ── Submissions: the file a student actually uploads ──
-- (the submission-files bucket + its RLS already exist from an earlier
-- migration; it was never given a column to point at what got uploaded)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE public.submissions ALTER COLUMN content DROP NOT NULL;

-- ── Attendance register ──────────────────────────────────────
-- Staff-marked only, never automatic. One row per student per session date.
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  student_id  UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('present','absent','late')),
  marked_by   UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_group_date ON public.attendance_records(group_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_records(student_id);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance: student or org staff read" ON public.attendance_records;
CREATE POLICY "attendance: student or org staff read" ON public.attendance_records FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organisation_id = public.current_user_org())
  );
DROP POLICY IF EXISTS "attendance: org staff write" ON public.attendance_records;
CREATE POLICY "attendance: org staff write" ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND marked_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organisation_id = public.current_user_org())
  );
DROP POLICY IF EXISTS "attendance: org staff update" ON public.attendance_records;
CREATE POLICY "attendance: org staff update" ON public.attendance_records FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.organisation_id = public.current_user_org())
  );
