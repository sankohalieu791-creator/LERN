-- Three pricing fixes, confirmed live and wrong by calling the functions
-- directly against production before writing this:
--
--   provider_annual_price(50)     -> 3500   (50 * October's £70/learner)
--   institution_annual_price(2000)-> 5125   (old £2,000 + £2.50/student formula)
--
-- Decision (16 Oct 2026): training providers stay on the August list
-- (£50/learner, capped £4,000; £4,000 flat 100-299; £6,000 flat 300-599)
-- until the product-matches-deck trigger is confirmed met -- October
-- was never actually approved, it just shipped. Institutions move to
-- the new flat bands (replacing the £2,000 + £2.50/student formula).
-- Bootcamp Evidence drops from £150/month (never an agreed number) to
-- the agreed £100/month flat, optional.
--
-- No real customer is affected: the only two organisations with a
-- billing_locked_annual_price set are the seeded demo accounts
-- (Riverside Academy, Brightspark Training) -- checked directly
-- against production before writing this migration.
--
-- get_org_billing() below is reproduced verbatim from
-- 2026-09-28-close-employer-billing-rpc-bypass.sql (the latest tracked
-- version, confirmed no later migration touches it) with two changes:
-- the 150 -> 100 literal on the bootcamp-annual line, and
-- is_custom_pricing extended to institutions at 6,000+ students -- the
-- old institution formula never returned null, so this flag only ever
-- had to cover providers at 600+; the new banded formula can now
-- return null for institutions too, and base_annual_price would be
-- null with no explanation without this. Everything else -- the
-- authorisation check, the subscription_status write, the adjustments
-- query -- is unchanged.

CREATE OR REPLACE FUNCTION public.provider_annual_price(p_learners integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_learners <= 99 THEN LEAST(p_learners * 50, 4000)
    WHEN p_learners <= 299 THEN 4000
    WHEN p_learners <= 599 THEN 6000
    ELSE NULL -- 600+: priced on application, not automatic
  END::numeric;
$$;

-- institution_band() drives sync_org_billing()'s band-change detection
-- (compared against the locked last_billing_band to decide whether a
-- renewal/proration is due) -- it was still on the old three-tier
-- scheme ('base'/'extended'/'capped', confirmed live via RPC call
-- before writing this). Left on the old scheme, a student count
-- crossing from 1,400 to 1,600 would stay "extended" on both sides and
-- never trigger the new band's price. Band key strings below match
-- lib/billing.ts's InstitutionBand type exactly.
CREATE OR REPLACE FUNCTION public.institution_band(p_students integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_students < 750 THEN 'under-750'
    WHEN p_students < 1500 THEN '750-1499'
    WHEN p_students < 2500 THEN '1500-2499'
    WHEN p_students < 4000 THEN '2500-3999'
    WHEN p_students < 6000 THEN '4000-5999'
    ELSE '6000+'
  END;
$$;

CREATE OR REPLACE FUNCTION public.institution_annual_price(p_students integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_students < 750 THEN 1500
    WHEN p_students < 1500 THEN 2000
    WHEN p_students < 2500 THEN 2500
    WHEN p_students < 4000 THEN 3000
    WHEN p_students < 6000 THEN 4500
    ELSE NULL -- 6,000+: priced on request, not automatic
  END::numeric;
$$;

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

  v_bootcamp_annual := CASE WHEN v_org.type = 'provider' AND v_org.bootcamp_evidence_enabled THEN 100 * 12 ELSE 0 END;
  v_total := COALESCE(v_org.billing_locked_annual_price, 0) + v_adjustments_total + v_bootcamp_annual;

  RETURN json_build_object(
    'org_type', v_org.type,
    'headcount', v_headcount,
    'base_annual_price', v_org.billing_locked_annual_price,
    'is_custom_pricing', (v_org.type = 'provider' AND v_headcount >= 600) OR (v_org.type = 'institution' AND v_headcount >= 6000),
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

-- get_org_billing_for_checkout() has the same is_custom_pricing gap --
-- its caller (app/api/stripe/org/create-checkout-session/route.ts)
-- already guards on `!computed.annual_price` too, so a null price
-- was never actually charged, but the label itself should still be
-- accurate for institutions at 6,000+. Reproduced verbatim from
-- 2026-09-24-org-stripe-billing.sql (confirmed no later migration
-- touches it) with only that one line changed.
CREATE OR REPLACE FUNCTION public.get_org_billing_for_checkout(p_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org RECORD;
  v_headcount INT;
  v_price NUMERIC;
  v_band TEXT;
BEGIN
  SELECT * INTO v_org FROM public.organisations WHERE id = p_org_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organisation not found'; END IF;

  SELECT count(*) INTO v_headcount
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  WHERE u.organisation_id = p_org_id AND u.role = 'student' AND a.last_sign_in_at IS NOT NULL;

  IF v_org.type = 'provider' THEN
    v_price := public.provider_annual_price(v_headcount);
    v_band := public.provider_band(v_headcount);
  ELSE
    v_price := public.institution_annual_price(v_headcount);
    v_band := public.institution_band(v_headcount);
  END IF;

  RETURN json_build_object(
    'org_type', v_org.type,
    'headcount', v_headcount,
    'annual_price', v_price,
    'band', v_band,
    'is_custom_pricing', (v_org.type = 'provider' AND v_headcount >= 600) OR (v_org.type = 'institution' AND v_headcount >= 6000)
  );
END;
$function$;

-- Re-lock the two demo orgs to the corrected formula so the investor
-- demo shows real current pricing instead of the October numbers, and
-- re-tag last_billing_band to the new scheme at the same time --
-- otherwise it'd read 'base'/'extended' against bands that no longer
-- exist, and the next get_org_billing() call would read that as a
-- band change and raise a bogus one-off "plan change adjustment" line
-- on demo data for a price change that was never a real renewal.
-- sync_org_billing() would otherwise only do this the next time
-- get_org_billing() runs for them, via its own proration path.
UPDATE public.organisations SET
  billing_locked_annual_price = public.institution_annual_price(public.get_org_billing_headcount(id)),
  last_billing_band = public.institution_band(public.get_org_billing_headcount(id))
WHERE id = '6d51daa7-01f6-4e4e-8198-a967755e88ae' AND type = 'institution';

UPDATE public.organisations SET
  billing_locked_annual_price = public.provider_annual_price(public.get_org_billing_headcount(id)),
  last_billing_band = public.provider_band(public.get_org_billing_headcount(id))
WHERE id = '0754b545-bc98-4bb4-ba9e-c53a4941812c' AND type = 'provider';
