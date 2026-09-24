-- Real Stripe billing for institutions/providers, on top of the
-- existing self-declared/computed model (organisations.billing_locked_
-- annual_price, sync_org_billing, get_org_billing -- all already live,
-- headcount-driven, with mid-cycle band-change adjustments tracked in
-- billing_adjustments). That system only ever *displayed* a number;
-- nothing collected it or gated access on it having been paid. This
-- migration adds the missing real-payment columns and a checkout-only
-- read helper, mirroring the employer_* pattern already proven in
-- get_employer_billing / cancel_employer_subscription.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

-- Extends the existing get_org_billing() output (adds fields, changes
-- nothing BillingPanel.tsx already reads) with the real payment state
-- the new OrgBillingGate needs, plus the same lazy canceled->restricted
-- flip get_employer_billing() already does once a grace period lapses.
CREATE OR REPLACE FUNCTION public.get_org_billing(p_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org RECORD;
  v_headcount INT;
  v_adjustments JSON;
  v_adjustments_total NUMERIC;
  v_bootcamp_annual NUMERIC;
  v_total NUMERIC;
BEGIN
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

-- Trusted-server-only read: no auth.uid() gate (the API route calling
-- this has already authenticated the caller and confirmed their role
-- and organisation_id from their access token before ever reaching
-- here), so it works from a service-role context where auth.uid() is
-- null -- unlike get_org_billing/sync_org_billing/get_org_billing_
-- headcount, which all require a real user JWT and would reject a
-- server-to-server call. Never granted to anon/authenticated.
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
    'is_custom_pricing', v_org.type = 'provider' AND v_headcount >= 600
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_org_billing_for_checkout(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_billing_for_checkout(uuid) TO service_role;
