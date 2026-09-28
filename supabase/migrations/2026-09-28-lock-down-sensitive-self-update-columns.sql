-- CRITICAL fix found during a full security audit.
--
-- RLS on both users and organisations only ever checked ROW ownership
-- ("is this your own row / your own org"), never which COLUMNS were
-- being changed. The only compensating control was a narrow trigger
-- (prevent_self_role_org_change) covering just role/organisation_id/
-- group_id/date_of_birth. Every other column -- including ones that
-- grant real capabilities -- was wide open to a plain client-side
-- .update() call, completely bypassing every RPC-level check added
-- earlier today. Concretely, before this migration, any authenticated
-- user could run (e.g. from devtools, using the app's own session):
--
--   supabase.from('users').update({ email: 'alieu@joinirl.co.uk' })
--     .eq('id', myOwnId)
--
-- and instantly pass is_lern_admin() (which matches on email), which
-- makes is_ops_admin() true -- full ops access: approve/reject
-- employers and organisations, safeguarding concerns, the admin audit
-- log, revoking other ops admins' access, everything. Or more directly:
--
--   supabase.from('users').update({ employer_verified: true,
--     employer_tier: 'scale', employer_subscription_status: 'active' })
--     .eq('id', myOwnId)
--
-- self-granting verified-employer status and a paid tier for free,
-- bypassing both Stripe and every check inside
-- approve_employer_verification()/set_employer_tier(). The exact same
-- shape existed on organisations: any institution/provider staff
-- member could self-set verified = true (bypassing LERN's entire
-- org-vetting process -- the actual child-safety gate that decides
-- whether real students can join that org at all), or self-grant a
-- free subscription, or overwrite stripe_customer_id/
-- stripe_subscription_id with another organisation's real Stripe IDs
-- and then use the legitimate cancel-subscription route to cancel a
-- competitor's real subscription.
--
-- Fix: extend both guard triggers to block every column that grants a
-- capability or feeds an approval decision, using the same
-- app.internal_org_join escape-hatch pattern already used by
-- accept_ops_invite/create_organisation_and_join/redeem_join_code/
-- set_student_group for the handful of legitimate RPC-driven
-- self-writes that need to get through.

create or replace function public.prevent_self_role_org_change()
returns trigger
language plpgsql
as $function$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.id THEN
    IF current_setting('app.internal_org_join', true) = 'true' THEN
      RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
      RAISE EXCEPTION 'Cannot change your own organisation';
    END IF;
    IF OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      RAISE EXCEPTION 'Cannot change your own date of birth — contact your organisation to correct it';
    END IF;
    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'Cannot change your own group — contact your organisation';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Cannot change your own email address';
    END IF;
    IF NEW.is_guest IS DISTINCT FROM OLD.is_guest THEN
      RAISE EXCEPTION 'Cannot change your own guest status';
    END IF;
    IF NEW.guest_invite_id IS DISTINCT FROM OLD.guest_invite_id THEN
      RAISE EXCEPTION 'Cannot change your own guest invite';
    END IF;
    IF NEW.is_demo_gateway IS DISTINCT FROM OLD.is_demo_gateway THEN
      RAISE EXCEPTION 'Cannot change this field';
    END IF;
    IF NEW.employer_verified IS DISTINCT FROM OLD.employer_verified THEN
      RAISE EXCEPTION 'Cannot change your own verification status';
    END IF;
    IF NEW.employer_verification_status IS DISTINCT FROM OLD.employer_verification_status THEN
      RAISE EXCEPTION 'Cannot change your own verification status';
    END IF;
    IF NEW.employer_check_ch IS DISTINCT FROM OLD.employer_check_ch
      OR NEW.employer_check_ch_detail IS DISTINCT FROM OLD.employer_check_ch_detail
      OR NEW.employer_ch_officers IS DISTINCT FROM OLD.employer_ch_officers
      OR NEW.employer_check_email_domain IS DISTINCT FROM OLD.employer_check_email_domain
      OR NEW.employer_check_website_confirmed IS DISTINCT FROM OLD.employer_check_website_confirmed
      OR NEW.employer_check_officer_confirmed IS DISTINCT FROM OLD.employer_check_officer_confirmed
      OR NEW.employer_check5_notes IS DISTINCT FROM OLD.employer_check5_notes THEN
      RAISE EXCEPTION 'Cannot change your own verification checks';
    END IF;
    IF NEW.employer_more_info_message IS DISTINCT FROM OLD.employer_more_info_message THEN
      RAISE EXCEPTION 'Cannot change this field';
    END IF;
    IF NEW.employer_tier IS DISTINCT FROM OLD.employer_tier
      OR NEW.employer_tier_set_at IS DISTINCT FROM OLD.employer_tier_set_at
      OR NEW.employer_subscription_status IS DISTINCT FROM OLD.employer_subscription_status
      OR NEW.employer_subscription_period_end IS DISTINCT FROM OLD.employer_subscription_period_end THEN
      RAISE EXCEPTION 'Cannot change your own billing — use Settings > Subscription';
    END IF;
    IF NEW.employer_stripe_customer_id IS DISTINCT FROM OLD.employer_stripe_customer_id
      OR NEW.employer_stripe_subscription_id IS DISTINCT FROM OLD.employer_stripe_subscription_id THEN
      RAISE EXCEPTION 'Cannot change your own billing identifiers';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- organisations had no equivalent guard at all -- only
-- check_safeguarding_lead(), which validates a safeguarding_lead_id
-- change but restricts nothing else. current_user_org() = OLD.id scopes
-- this to "a member of the org actually being changed", not auth.uid()
-- (organisations.id isn't a user id); is_ops_admin() and the internal
-- bypass flag both still short-circuit it exactly like the users guard.
create or replace function public.guard_org_sensitive_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF public.current_user_org() = OLD.id
    AND NOT public.is_ops_admin()
    AND current_setting('app.internal_org_join', true) IS DISTINCT FROM 'true'
  THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified THEN
      RAISE EXCEPTION 'Cannot change your own organisation''s verification status';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'Cannot change your own organisation''s type';
    END IF;
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
      OR NEW.billing_locked_annual_price IS DISTINCT FROM OLD.billing_locked_annual_price
      OR NEW.billing_cycle_start IS DISTINCT FROM OLD.billing_cycle_start
      OR NEW.billing_current_cycle_start IS DISTINCT FROM OLD.billing_current_cycle_start
      OR NEW.last_billing_band IS DISTINCT FROM OLD.last_billing_band
      OR NEW.subscription_period_end IS DISTINCT FROM OLD.subscription_period_end THEN
      RAISE EXCEPTION 'Cannot change your own organisation''s billing';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
      RAISE EXCEPTION 'Cannot change your own organisation''s billing identifiers';
    END IF;
    IF NEW.bootcamp_evidence_enabled IS DISTINCT FROM OLD.bootcamp_evidence_enabled
      OR NEW.bootcamp_evidence_enabled_at IS DISTINCT FROM OLD.bootcamp_evidence_enabled_at THEN
      RAISE EXCEPTION 'Use the Bootcamp Evidence toggle to change this';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

drop trigger if exists guard_org_sensitive_fields on public.organisations;
create trigger guard_org_sensitive_fields
  before update on public.organisations
  for each row execute function public.guard_org_sensitive_fields();

-- Everything below adds the same app.internal_org_join escape hatch
-- (already used elsewhere in this schema for exactly this reason) to
-- the handful of legitimate RPCs that now need to get past the new
-- guards above to write their own caller's row.

create or replace function public.submit_more_employer_info(p_message text)
returns void
language plpgsql
security definer
as $function$
BEGIN
  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users
  SET employer_more_info_response = NULLIF(trim(p_message), ''), employer_verification_status = 'pending'
  WHERE id = auth.uid();
END;
$function$;

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

  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users SET employer_tier = p_tier, employer_tier_set_at = now(), employer_subscription_status = 'active', employer_subscription_period_end = NULL
  WHERE id = p_employer_id;
END;
$function$;

create or replace function public.get_employer_billing(p_employer_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_user RECORD;
  v_pools INT;
  v_postings INT;
BEGIN
  IF NOT (auth.uid() = p_employer_id OR public.is_ops_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users
  SET employer_subscription_status = 'restricted'
  WHERE id = p_employer_id AND employer_subscription_status = 'canceled' AND employer_subscription_period_end <= now();

  SELECT * INTO v_user FROM public.users WHERE id = p_employer_id;
  SELECT count(*) INTO v_pools FROM public.talent_pools WHERE employer_id = p_employer_id;
  SELECT count(*) INTO v_postings FROM public.opportunities WHERE employer_id = p_employer_id AND closed_at IS NULL;

  RETURN json_build_object(
    'tier', v_user.employer_tier,
    'subscription_status', v_user.employer_subscription_status,
    'subscription_period_end', v_user.employer_subscription_period_end,
    'talent_pools_used', v_pools,
    'active_job_postings_used', v_postings,
    'has_stripe_subscription', v_user.employer_stripe_subscription_id is not null
  );
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
  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users
  SET employer_subscription_status = 'canceled', employer_subscription_period_end = now() + interval '30 days'
  WHERE id = p_employer_id;
END;
$function$;

create or replace function public.set_bootcamp_evidence(p_org_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT (public.current_user_org() = p_org_id AND public.current_user_role() = ANY (ARRAY['institution_staff','provider_staff'])) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF (SELECT type FROM public.organisations WHERE id = p_org_id) <> 'provider' THEN
    RAISE EXCEPTION 'Bootcamp Evidence is a training-provider feature';
  END IF;
  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.organisations
  SET bootcamp_evidence_enabled = p_enabled,
      bootcamp_evidence_enabled_at = CASE WHEN p_enabled THEN now() ELSE bootcamp_evidence_enabled_at END
  WHERE id = p_org_id;
END;
$function$;

create or replace function public.sync_org_billing(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_org RECORD;
  v_headcount INT;
  v_live_price NUMERIC;
  v_live_band TEXT;
  v_current_cycle_start DATE;
  v_years_elapsed INT;
  v_months_elapsed INT;
  v_months_remaining INT;
  v_adjustment NUMERIC;
BEGIN
  IF NOT (public.is_ops_admin() OR (public.current_user_org() = p_org_id AND public.current_user_role() = ANY (ARRAY['institution_staff','provider_staff']))) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  PERFORM set_config('app.internal_org_join', 'true', true);

  SELECT * INTO v_org FROM public.organisations WHERE id = p_org_id;
  v_headcount := public.get_org_billing_headcount(p_org_id);

  IF v_org.type = 'provider' THEN
    v_live_price := public.provider_annual_price(v_headcount);
    v_live_band := public.provider_band(v_headcount);
  ELSE
    v_live_price := public.institution_annual_price(v_headcount);
    v_live_band := public.institution_band(v_headcount);
  END IF;

  v_years_elapsed := GREATEST(extract(year FROM age(CURRENT_DATE, v_org.billing_cycle_start))::int, 0);
  v_current_cycle_start := v_org.billing_cycle_start + (v_years_elapsed || ' years')::interval;
  IF v_current_cycle_start > CURRENT_DATE THEN
    v_current_cycle_start := v_current_cycle_start - interval '1 year';
  END IF;

  IF v_org.billing_current_cycle_start IS NULL OR v_org.billing_current_cycle_start <> v_current_cycle_start THEN
    UPDATE public.organisations
    SET billing_current_cycle_start = v_current_cycle_start, billing_locked_annual_price = v_live_price, last_billing_band = v_live_band
    WHERE id = p_org_id;
    RETURN;
  END IF;

  IF v_live_band <> v_org.last_billing_band THEN
    IF v_live_price IS NOT NULL AND v_org.billing_locked_annual_price IS NOT NULL AND v_live_price > v_org.billing_locked_annual_price THEN
      v_months_elapsed := extract(year FROM age(CURRENT_DATE, v_current_cycle_start))::int * 12 + extract(month FROM age(CURRENT_DATE, v_current_cycle_start))::int;
      v_months_remaining := GREATEST(12 - v_months_elapsed, 0);
      v_adjustment := round(((v_live_price - v_org.billing_locked_annual_price) / 12) * v_months_remaining);
      INSERT INTO public.billing_adjustments (organisation_id, cycle_start, description, amount)
      VALUES (p_org_id, v_current_cycle_start, format('Plan change adjustment (%s months remaining)', v_months_remaining), v_adjustment);
      UPDATE public.organisations SET billing_locked_annual_price = v_live_price, last_billing_band = v_live_band WHERE id = p_org_id;
    ELSE
      UPDATE public.organisations SET last_billing_band = v_live_band WHERE id = p_org_id;
    END IF;
  END IF;
END;
$function$;

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

  PERFORM set_config('app.internal_org_join', 'true', true);
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

-- set_course_live() had zero authorisation check at all (any anon or
-- authenticated caller could flip any course session's live flag) and
-- operates on course_sessions, a table from the old v1 course-scheduling
-- system that the current product no longer uses (see WorkItemsPanel's
-- own comment) -- confirmed zero client call sites. Revoked rather than
-- patched with an ownership check, since there's no current owner
-- concept to check against and nothing legitimate calls it.
revoke execute on function public.set_course_live(uuid, boolean) from anon, authenticated, public;
