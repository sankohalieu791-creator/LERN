-- Fix: the "every non-employer must have an organisation_id" CHECK
-- constraint on public.users blocked signup itself. handle_new_user()
-- creates the profile row the instant auth.users gets a new row — at
-- that point a student hasn't redeemed a join code yet (that's a
-- separate step, via redeem_join_code()), so organisation_id is briefly
-- NULL. The CHECK rejected that row outright, failing the entire signup
-- transaction before the student ever got a chance to join an org.
--
-- "Belongs to an org, or hasn't joined one yet" is a real, valid state
-- for a freshly-signed-up student — not a data integrity violation.
-- Enforcing "must have joined an org before X" belongs at the app layer
-- (e.g. gating access to work_items/submissions until organisation_id is
-- set — which RLS already does implicitly, since every policy keys off
-- current_user_org()), not as a blanket DB constraint on signup itself.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_check;
