-- Live-session chat and Q&A. Persisted (not just an ephemeral broadcast)
-- so someone joining late still sees what was said. Run in the Supabase
-- SQL Editor.
CREATE TABLE IF NOT EXISTS public.workshop_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id  UUID REFERENCES public.work_items(id) ON DELETE CASCADE NOT NULL,
  sender_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','question')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshop_messages_work_item ON public.workshop_messages(work_item_id, created_at);
ALTER TABLE public.workshop_messages ENABLE ROW LEVEL SECURITY;

-- Same audience as the session itself: anyone in the org (or the whole
-- group it's assigned to) can read/post -- no stranger reaches this,
-- workshops aren't public the way feed posts can be.
DROP POLICY IF EXISTS "workshop_messages: org read" ON public.workshop_messages;
CREATE POLICY "workshop_messages: org read" ON public.workshop_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org()));
DROP POLICY IF EXISTS "workshop_messages: org insert" ON public.workshop_messages;
CREATE POLICY "workshop_messages: org insert" ON public.workshop_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.work_items wi WHERE wi.id = work_item_id AND wi.organisation_id = public.current_user_org())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workshop_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_messages;
  END IF;
END $$;
