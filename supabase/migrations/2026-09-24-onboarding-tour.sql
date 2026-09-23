-- Onboarding tour ("take a tour or skip", role-specific walkthrough) --
-- 24 Sep 2026. Tracks whether an org account has been through (or
-- explicitly skipped) the first-login intro, so it only ever shows
-- once automatically; a "Replay tutorial" action in Settings can
-- reopen it any time regardless of this flag.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
