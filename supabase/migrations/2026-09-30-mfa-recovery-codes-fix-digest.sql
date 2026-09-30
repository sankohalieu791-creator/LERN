-- generate_mfa_recovery_codes() and verify_and_consume_recovery_code()
-- both set search_path to 'public' only (correct hardening for a
-- SECURITY DEFINER function), but pgcrypto's digest() lives in the
-- 'extensions' schema on this project, not 'public' -- so every call
-- failed with "function digest(text, unknown) does not exist". This
-- silently broke enrollment: the TOTP code itself would verify fine,
-- but the recovery-codes step right after it always threw, and the
-- UI surfaced that as "that code didn't match", misleading anyone
-- into retrying a code that was already correct.
--
-- Also fixes a separate off-by-one: the alphabet below is 31
-- characters (0/O/1/I/L removed on purpose), but the index was drawn
-- from 1..32. Postgres's substr() returns '' rather than erroring on
-- an out-of-range start, so roughly 1 in 32 characters silently went
-- missing -- codes were meant to always be 10 characters but came out
-- 9 characters about a quarter of the time.
create or replace function public.generate_mfa_recovery_codes()
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_codes text[] := '{}';
  v_code text;
  i int;
  j int;
BEGIN
  DELETE FROM public.mfa_recovery_codes WHERE user_id = auth.uid();

  FOR i IN 1..8 LOOP
    v_code := '';
    FOR j IN 1..10 LOOP
      v_code := v_code || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1);
    END LOOP;
    v_codes := array_append(v_codes, v_code);
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash) VALUES (auth.uid(), encode(extensions.digest(v_code, 'sha256'), 'hex'));
  END LOOP;

  RETURN v_codes;
END;
$function$;

create or replace function public.verify_and_consume_recovery_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.mfa_recovery_codes
  WHERE user_id = auth.uid() AND used_at IS NULL
    AND code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
  LIMIT 1;

  IF v_id IS NULL THEN RETURN false; END IF;

  UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = v_id;
  RETURN true;
END;
$function$;
