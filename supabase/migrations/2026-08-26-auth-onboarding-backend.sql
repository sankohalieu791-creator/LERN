-- ============================================================
-- LERN v2 — backend support for the auth/onboarding blueprint.
--
-- Three real gaps found while designing the sign-up flows:
--
-- 1. redeem_join_code() already existed, but its internal UPDATE of
--    organisation_id fires the role/org tamper guard trigger — which
--    unconditionally blocks ANY self-UPDATE of organisation_id,
--    including this legitimate one. Join-by-code was silently broken.
--
-- 2. Self-serve organisation sign-up (O1-O3) needs the signing-up user
--    to (a) create an organisation and (b) become its staff member —
--    but `organisations` has no INSERT policy (I'd designed org
--    creation as admin-only, before this spec asked for self-serve
--    sign-up), and the same tamper guard blocks step (b) too.
--
-- 3. Consent tracking ("must actively accept, never pre-ticked") has
--    nowhere to be recorded — no consent column exists anywhere in the
--    v2 schema.
--
-- Fix for 1+2: the guard trigger now allows organisation_id/role to be
-- set FROM NULL, but only when a session-local flag is set — a flag a
-- plain client PATCH request has no way to set (it's not a column,
-- header, or anything PostgREST exposes; only SQL running inside the
-- function itself can set it). So the exception is only reachable
-- through the two controlled functions below, never through a direct
-- client UPDATE — a student still cannot self-assign into any org by
-- just PATCHing their own row.
--
-- Run this before building the sign-up pages against it.
-- ============================================================

ALTER TABLE public.users ADD COLUMN consented_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.prevent_self_role_org_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() = OLD.id THEN
    -- Trusted, one-time "joining an organisation for the first time"
    -- path — only reachable via redeem_join_code() or
    -- create_organisation_and_join() below, which set this flag
    -- themselves right before their own internal UPDATE. A direct
    -- client PATCH can never set this flag, so this is not a general
    -- bypass — a student still can't self-assign an organisation_id.
    IF current_setting('app.internal_org_join', true) = 'true' THEN
      RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
      RAISE EXCEPTION 'Cannot change your own organisation';
    END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      RAISE EXCEPTION 'Cannot change your own date of birth — contact your organisation to correct it';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_join_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND organisation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already belong to an organisation';
  END IF;

  SELECT organisation_id INTO v_org
  FROM public.join_codes
  WHERE code = p_code
    AND revoked = FALSE
    AND (expires_at IS NULL OR expires_at > now());

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired join code';
  END IF;

  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users SET organisation_id = v_org WHERE id = auth.uid();
  RETURN v_org;
END;
$$;

-- Self-serve organisation sign-up: the signing-up user creates the
-- org and becomes its staff member (institution_staff or
-- provider_staff, matching the org type) in one atomic step, and is
-- named safeguarding lead by default since they're the only person
-- who exists in the org yet — "every organisation must name a
-- safeguarding lead at sign-up" is satisfied because one now exists;
-- it can be reassigned to someone else once more staff join.
CREATE OR REPLACE FUNCTION public.create_organisation_and_join(
  p_name TEXT, p_type TEXT, p_full_name TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
BEGIN
  IF p_type NOT IN ('institution', 'provider') THEN
    RAISE EXCEPTION 'Invalid organisation type';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND organisation_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already belong to an organisation';
  END IF;

  v_role := CASE WHEN p_type = 'institution' THEN 'institution_staff' ELSE 'provider_staff' END;

  INSERT INTO public.organisations (name, type) VALUES (p_name, p_type)
  RETURNING id INTO v_org_id;

  PERFORM set_config('app.internal_org_join', 'true', true);
  UPDATE public.users
  SET organisation_id = v_org_id,
      role = v_role,
      full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name)
  WHERE id = auth.uid();

  UPDATE public.organisations SET safeguarding_lead_id = auth.uid() WHERE id = v_org_id;

  RETURN v_org_id;
END;
$$;
