-- Session recording. Run in the Supabase SQL Editor.
--
-- Requires Agora Cloud Recording credentials + a storage bucket Agora
-- uploads to directly -- neither is reachable from SQL or this codebase,
-- you'll need to set these up yourself (same category as the Resend key):
--   1. Agora Console -> your project -> enable "Cloud Recording", then
--      Console -> RESTful API -> generate a Customer ID + Secret (this
--      is DIFFERENT from the App ID/Certificate already in .env.local).
--      Add as AGORA_CUSTOMER_ID / AGORA_CUSTOMER_SECRET in Vercel.
--   2. An S3 bucket Agora is allowed to write to. Add AGORA_RECORDING_
--      S3_BUCKET / AGORA_RECORDING_S3_REGION / AGORA_RECORDING_S3_
--      ACCESS_KEY / AGORA_RECORDING_S3_SECRET_KEY in Vercel.
-- Until both are set, the Record button shows "not set up yet" instead
-- of failing silently.

CREATE TABLE IF NOT EXISTS public.work_item_recordings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id UUID REFERENCES public.work_items(id) ON DELETE CASCADE NOT NULL,
  resource_id  TEXT NOT NULL,
  sid          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','stopped','available','failed')),
  file_list    JSONB,
  started_by   UUID REFERENCES public.users(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recordings_work_item ON public.work_item_recordings(work_item_id);
ALTER TABLE public.work_item_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recordings: org read" ON public.work_item_recordings;
CREATE POLICY "recordings: org read" ON public.work_item_recordings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()));
DROP POLICY IF EXISTS "recordings: org staff write" ON public.work_item_recordings;
CREATE POLICY "recordings: org staff insert" ON public.work_item_recordings FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org())
  );
DROP POLICY IF EXISTS "recordings: org staff update" ON public.work_item_recordings;
CREATE POLICY "recordings: org staff update" ON public.work_item_recordings FOR UPDATE
  USING (
    public.current_user_role() IN ('institution_staff','provider_staff')
    AND EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org())
  );
