-- Closes a live billing bypass found during a full bug audit.
--
-- set_employer_tier() and cancel_employer_subscription() predate the
-- real Stripe integration (create-checkout-session / change-tier /
-- cancel-subscription routes, see app/api/stripe/*). Once those
-- shipped, the client was updated to only call set_employer_tier()
-- directly for 'enterprise' (no price, sales-led) and to route
-- micro/growth/scale through Stripe -- but nothing enforced that
-- server-side, which is the only boundary that actually matters: any
-- authenticated employer could call
--   supabase.rpc('set_employer_tier', { p_employer_id: <self>, p_tier: 'scale' })
-- directly (browser console, curl+bearer token, etc.) and grant
-- themselves a paid tier with employer_subscription_status = 'active'
-- for free, completely bypassing Stripe. cancel_employer_subscription()
-- has the same shape of problem: it's fully superseded by
-- /api/stripe/cancel-subscription (which cancels the real Stripe
-- subscription, or falls back to the same DB-only behaviour for a
-- pre-Stripe account) and has no remaining legitimate direct caller,
-- yet was still self-callable and would silently desync local status
-- from Stripe's real state.

create or replace function public.set_employer_tier(p_employer_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_pools INT;
  v_postings INT;
  v_pool_limit INT;
  v_posting_limit INT;
BEGIN
  IF NOT (auth.uid() = p_employer_id OR public.is_ops_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF p_tier NOT IN ('micro','growth','scale','enterprise') THEN RAISE EXCEPTION 'Invalid tier'; END IF;
  IF p_tier <> 'enterprise' AND NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Paid tiers must be purchased through Stripe checkout.';
  END IF;

  v_pool_limit := CASE p_tier WHEN 'micro' THEN 5 WHEN 'growth' THEN 20 WHEN 'scale' THEN 35 ELSE NULL END;
  v_posting_limit := CASE p_tier WHEN 'micro' THEN 5 WHEN 'growth' THEN 20 WHEN 'scale' THEN 35 ELSE NULL END;

  SELECT count(*) INTO v_pools FROM public.talent_pools WHERE employer_id = p_employer_id;
  SELECT count(*) INTO v_postings FROM public.opportunities WHERE employer_id = p_employer_id AND closed_at IS NULL;

  IF v_pool_limit IS NOT NULL AND v_pools > v_pool_limit THEN
    RAISE EXCEPTION 'You have % talent pools, which is more than this tier''s limit of %. Remove some pools first.', v_pools, v_pool_limit;
  END IF;
  IF v_posting_limit IS NOT NULL AND v_postings > v_posting_limit THEN
    RAISE EXCEPTION 'You have % active job postings, which is more than this tier''s limit of %. Close some postings first.', v_postings, v_posting_limit;
  END IF;

  UPDATE public.users SET employer_tier = p_tier, employer_tier_set_at = now(), employer_subscription_status = 'active', employer_subscription_period_end = NULL
  WHERE id = p_employer_id;
END;
$function$;

create or replace function public.cancel_employer_subscription(p_employer_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT public.is_ops_admin() THEN
    RAISE EXCEPTION 'Use Settings > Subscription to cancel -- that cancels the real Stripe subscription too.';
  END IF;
  UPDATE public.users
  SET employer_subscription_status = 'canceled', employer_subscription_period_end = now() + interval '30 days'
  WHERE id = p_employer_id;
END;
$function$;

-- Separately: _test_mark_logged_in() is a billing-live.test.mjs-only
-- debug helper (UPDATEs auth.users.last_sign_in_at for any id array)
-- that had zero authorisation check and was reachable by anon over
-- PostgREST. The test script calls it via a service_role client, so
-- revoking anon/authenticated access doesn't break it.
revoke execute on function public._test_mark_logged_in(uuid[]) from anon, authenticated;
grant execute on function public._test_mark_logged_in(uuid[]) to service_role;

-- get_org_billing() had no authorisation check at all -- unlike its
-- own sibling get_org_billing_headcount() (which correctly requires
-- is_ops_admin() or same-org staff), and unlike get_org_billing_for_
-- checkout() (locked down via REVOKE/GRANT to service_role only).
-- EXECUTE was granted to anon AND authenticated, and organisations_public
-- (id/name/type) is readable by everyone, so any org's ID was
-- enumerable and this returned that org's real subscription status,
-- annual price, headcount and Stripe-subscription flag to literally
-- anyone, logged in or not -- a full cross-tenant billing data leak.
-- It also runs sync_org_billing() and can flip subscription_status to
-- 'restricted' as a side effect, so an unauthenticated caller could
-- trigger that write path against arbitrary orgs too. Same guard as
-- get_org_billing_headcount, added before any of that runs.
create or replace function public.get_org_billing(p_org_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_org RECORD;
  v_headcount INT;
  v_adjustments JSON;
  v_adjustments_total NUMERIC;
  v_bootcamp_annual NUMERIC;
  v_total NUMERIC;
BEGIN
  IF NOT (public.is_ops_admin() OR (public.current_user_org() = p_org_id AND public.current_user_role() = ANY (ARRAY['institution_staff','provider_staff']))) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  PERFORM public.sync_org_billing(p_org_id);

  UPDATE public.organisations
  SET subscription_status = 'restricted'
  WHERE id = p_org_id AND subscription_status = 'canceled' AND subscription_period_end <= now();

  SELECT * INTO v_org FROM public.organisations WHERE id = p_org_id;
  v_headcount := public.get_org_billing_headcount(p_org_id);

  SELECT COALESCE(json_agg(json_build_object('description', description, 'amount', amount) ORDER BY created_at), '[]'::json),
         COALESCE(sum(amount), 0)
  INTO v_adjustments, v_adjustments_total
  FROM public.billing_adjustments
  WHERE organisation_id = p_org_id AND cycle_start = v_org.billing_current_cycle_start;

  v_bootcamp_annual := CASE WHEN v_org.type = 'provider' AND v_org.bootcamp_evidence_enabled THEN 150 * 12 ELSE 0 END;
  v_total := COALESCE(v_org.billing_locked_annual_price, 0) + v_adjustments_total + v_bootcamp_annual;

  RETURN json_build_object(
    'org_type', v_org.type,
    'headcount', v_headcount,
    'base_annual_price', v_org.billing_locked_annual_price,
    'is_custom_pricing', v_org.type = 'provider' AND v_headcount >= 600,
    'bootcamp_evidence_enabled', v_org.bootcamp_evidence_enabled,
    'bootcamp_evidence_annual', v_bootcamp_annual,
    'adjustments', v_adjustments,
    'adjustments_total', v_adjustments_total,
    'total', v_total,
    'billing_cycle_start', v_org.billing_cycle_start,
    'billing_current_cycle_start', v_org.billing_current_cycle_start,
    'subscription_status', v_org.subscription_status,
    'subscription_period_end', v_org.subscription_period_end,
    'has_stripe_subscription', v_org.stripe_subscription_id IS NOT NULL
  );
END;
$function$;
