-- Client-side session recording (the pre-rebuild app's approach, brought
-- back as the working option while Agora Cloud Recording's external
-- credentials are still pending — see 2026-08-28-session-recording.sql).
--
-- This is deliberately NOT the same thing as Agora Cloud Recording: it
-- uses the browser's own MediaRecorder API against the host's local
-- camera/mic, so it only ever captures the host's own feed, not every
-- participant mixed together. Both paths write into the same
-- work_item_recordings table (from the earlier migration) so recordings
-- show up together regardless of which method produced them --
-- resource_id/sid are Agora-specific and just get a placeholder value
-- ('local') for a recording that came from this path instead.
--
-- Run in the Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-recordings', 'session-recordings', FALSE, 524288000, -- 500MB cap
  ARRAY['video/webm', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: {work_item_id}/{timestamp}_{filename} — scoped by
-- work item (not by uploader) so any staff member in the org can find
-- and play back a recording of a session, not just whoever recorded it.
DROP POLICY IF EXISTS "session-recordings: org staff upload" ON storage.objects;
DROP POLICY IF EXISTS "session-recordings: org staff read" ON storage.objects;

CREATE POLICY "session-recordings: org staff upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'session-recordings'
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id::text = (storage.foldername(name))[1]
        AND wi.organisation_id = public.current_user_org()
    )
  );
CREATE POLICY "session-recordings: org staff read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'session-recordings'
    AND public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (
      SELECT 1 FROM public.work_items wi
      WHERE wi.id::text = (storage.foldername(name))[1]
        AND wi.organisation_id = public.current_user_org()
    )
  );

-- work_item_recordings.resource_id/sid are NOT NULL (Agora-specific) --
-- give them a default so a client-inserted "local" recording row
-- doesn't need to fake Agora identifiers.
ALTER TABLE public.work_item_recordings ALTER COLUMN resource_id SET DEFAULT 'local';
ALTER TABLE public.work_item_recordings ALTER COLUMN sid SET DEFAULT 'local';

-- The client inserts this row directly (no server route involved for
-- the local-recording path) -- same "org staff insert" policy already
-- covers it, just confirming visibility here for anyone reading this
-- migration on its own.
