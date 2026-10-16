-- admin_audit_log had a 3-week gap -- last employer_approved entry was
-- 2026-09-24 -- that didn't match reality: two employers (seeded demo
-- accounts trading as "Lumen Creative Agency" and "Northfield
-- Engineering Ltd") were created already approved on 2026-10-12 with
-- no log entry at all. Root cause: scratch/seed-institution-demo.mjs
-- inserts the user row directly with employer_verification_status
-- already set to 'approved', bypassing approve_employer_verification()
-- entirely -- that RPC is the only thing that writes to
-- admin_audit_log today.
--
-- This closes that specific gap: any INSERT that creates an employer
-- row already approved/rejected gets logged automatically, so a seed
-- script (or any other direct insert) can no longer skip the trail.
-- It deliberately does NOT fire on UPDATE -- approve_employer_verification()
-- already logs every UPDATE-path approval itself, and an UPDATE trigger
-- here would double-log every real approval made through the admin UI.

CREATE OR REPLACE FUNCTION log_employer_created_preapproved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'employer' AND NEW.employer_verification_status IN ('approved', 'rejected') THEN
    INSERT INTO admin_audit_log (actor_email, action, target_type, target_id, detail)
    VALUES (
      'system (row inserted pre-' || NEW.employer_verification_status || ')',
      'employer_' || NEW.employer_verification_status,
      'employer',
      NEW.id,
      'Created directly with status already set -- did not go through approve_employer_verification()'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_employer_created_preapproved ON users;
CREATE TRIGGER trg_log_employer_created_preapproved
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION log_employer_created_preapproved();
