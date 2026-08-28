-- Defense-in-depth check: the original schema drafted a CHECK constraint
-- requiring every non-employer to have an organisation_id, which would
-- have silently broken "explore without code" (a student skipping the
-- join-code step gets organisation_id = NULL). Verified live that this
-- constraint isn't actually enforced on the current DB (a null-org
-- student insert already succeeds -- it must have been dropped by an
-- earlier fix migration), so this is a no-op in practice today, just
-- making the intended rule explicit and idempotent-safe either way:
-- staff must have an org, students and employers don't have to.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%role = ''employer'' OR organisation_id IS NOT NULL%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_conname);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_org_required_for_staff') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_org_required_for_staff
      CHECK (role IN ('employer','student') OR organisation_id IS NOT NULL);
  END IF;
END $$;
