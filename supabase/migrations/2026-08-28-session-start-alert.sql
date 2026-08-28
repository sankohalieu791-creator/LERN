-- Scheduled start time for online workshops/courses ("don't show it as
-- started until that date and time"), plus a "session has started, join
-- now" alert the moment the host actually opens the room.
-- Run in the Supabase SQL Editor.

ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('submission_received','work_returned','work_verified','employer_interest','report','session_started'));
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES public.work_items(id) ON DELETE CASCADE;

-- Staff-only (checked in the RPC, not just RLS on the table, since this
-- also needs to fan out notifications atomically with the flag flip).
-- Only fires the alert the FIRST time a session is opened -- rejoining
-- an already-started session doesn't re-notify everyone.
CREATE OR REPLACE FUNCTION public.start_work_item_session(p_work_item_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
  v_group UUID;
  v_already_started BOOLEAN;
BEGIN
  IF public.current_user_role() NOT IN ('institution_staff','provider_staff') THEN
    RAISE EXCEPTION 'Only staff can start a session';
  END IF;

  SELECT organisation_id, group_id, started_at IS NOT NULL INTO v_org, v_group, v_already_started
  FROM public.work_items WHERE id = p_work_item_id AND organisation_id = public.current_user_org();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Work item not found in your organisation';
  END IF;

  UPDATE public.work_items SET started_at = COALESCE(started_at, now()) WHERE id = p_work_item_id;

  IF NOT v_already_started THEN
    INSERT INTO public.notifications (user_id, type, work_item_id)
    SELECT id, 'session_started', p_work_item_id
    FROM public.users
    WHERE role = 'student'
      AND organisation_id = v_org
      AND (v_group IS NULL OR group_id = v_group);
  END IF;
END;
$$;
