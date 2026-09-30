-- Real two-step verification, replacing the two_step_enabled column
-- that was a plain toggle connected to nothing -- no QR code, no
-- authenticator enrollment, nothing checked at login. Uses Supabase
-- Auth's own native TOTP MFA (supabase.auth.mfa.*) for the actual
-- second factor -- battle-tested secret generation/storage/code
-- verification, not hand-rolled. This migration only adds what
-- Supabase's own MFA system doesn't provide: backup recovery codes,
-- so losing a phone doesn't mean permanently losing the account
-- (a real risk for e.g. a school's sole safeguarding lead).
--
-- Codes are stored as SHA-256 hashes, never plaintext -- they're only
-- ever shown to the user once, at generation time, same as any real
-- backup-code system (GitHub, Google, etc).
create extension if not exists pgcrypto;

create table public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index mfa_recovery_codes_user_id_idx on public.mfa_recovery_codes(user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
-- No direct client policy at all, deliberately -- these are bearer
-- credentials that bypass the second factor entirely if read or
-- forged. Every access goes through a SECURITY DEFINER function below.

-- Called once, right after a TOTP factor is successfully verified.
-- Wipes any old codes first (re-generating always fully replaces the
-- set, never appends) and returns the new PLAINTEXT codes -- the only
-- moment they ever exist outside a hash.
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
BEGIN
  DELETE FROM public.mfa_recovery_codes WHERE user_id = auth.uid();

  FOR i IN 1..8 LOOP
    -- 10 chars from an unambiguous alphabet (no 0/O/1/I/L) -- read
    -- back accurately off a printed sheet or a phone screen.
    v_code := '';
    FOR j IN 1..10 LOOP
      v_code := v_code || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1);
    END LOOP;
    v_codes := array_append(v_codes, v_code);
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash) VALUES (auth.uid(), encode(digest(v_code, 'sha256'), 'hex'));
  END LOOP;

  RETURN v_codes;
END;
$function$;

-- Self-scoped via auth.uid() -- the caller must already hold a live
-- (aal1) session for the account the code belongs to; this doesn't
-- authenticate anyone from scratch, only checks a code the person
-- claiming to be them supplied. The actual "let them back in without
-- their lost authenticator" step (deleting the MFA factor server-side)
-- happens in app/api/mfa/recover, using the service role -- a plain
-- SQL function can't reach into Supabase Auth's own factor storage.
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
    AND code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex')
  LIMIT 1;

  IF v_id IS NULL THEN RETURN false; END IF;

  UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = v_id;
  RETURN true;
END;
$function$;

create or replace function public.has_unused_recovery_codes()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT count(*)::int FROM public.mfa_recovery_codes WHERE user_id = auth.uid() AND used_at IS NULL;
$function$;

revoke execute on function public.generate_mfa_recovery_codes() from anon;
revoke execute on function public.verify_and_consume_recovery_code(text) from anon;
revoke execute on function public.has_unused_recovery_codes() from anon;
grant execute on function public.generate_mfa_recovery_codes() to authenticated;
grant execute on function public.verify_and_consume_recovery_code(text) to authenticated;
grant execute on function public.has_unused_recovery_codes() to authenticated;
