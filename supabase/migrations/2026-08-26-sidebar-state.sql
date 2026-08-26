-- Collapsed/expanded sidebar state, remembered server-side (not
-- browser-only) so it persists across devices/logins per the layout spec.
-- Not sensitive like role/organisation_id — no guard needed, the existing
-- "users: update own" policy already covers it.
ALTER TABLE public.users ADD COLUMN sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE;
