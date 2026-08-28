-- Presence: active/busy/away, chosen by the user, shown as a coloured
-- dot on their profile. Run in the Supabase SQL Editor.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS presence_status TEXT NOT NULL DEFAULT 'active'
  CHECK (presence_status IN ('active','busy','away'));
