-- ============================================================
-- Self-reported skills: a student declares a skill and attaches
-- evidence (a file is required -- enforced by evidence_file_path
-- being NOT NULL, same rule at the client). No institution setup
-- needed, and no teacher confirmation step either, per direct
-- instruction: a student already belongs to a vetted institution, so
-- that membership is treated as the trust signal rather than a
-- second per-skill check. Simpler than the earlier design this
-- replaces (no status/confirm RPC/staff queue at all) -- deliberately
-- NOT a reuse of the institution-authored `skills` table (owned by a
-- course_id, the wrong shape for a student-invented skill name).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.self_reported_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id), -- denormalized at insert time from the student's own org, same pattern work_items/placements already use, for simple RLS with no join
  name text not null,
  note text,
  evidence_file_path text not null,
  evidence_file_type text,
  created_at timestamptz not null default now()
);
ALTER TABLE public.self_reported_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_reported_skills: student read own" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: student read own" ON public.self_reported_skills
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "self_reported_skills: student insert own" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: student insert own" ON public.self_reported_skills
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "self_reported_skills: org staff read" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: org staff read" ON public.self_reported_skills
  FOR SELECT USING (
    current_user_role() IN ('institution_staff','provider_staff')
    AND organisation_id = current_user_org()
  );

-- Employer-facing: same has_verification() gate as the leveled skills
-- and the candidate's profile row itself -- only for a student who's
-- already discoverable at all. Every row here is already "shown as
-- verified" (no status column to check), per the instruction above.
DROP POLICY IF EXISTS "self_reported_skills: employer read confirmed for discoverable students" ON public.self_reported_skills;
DROP POLICY IF EXISTS "self_reported_skills: employer read for discoverable students" ON public.self_reported_skills;
CREATE POLICY "self_reported_skills: employer read for discoverable students" ON public.self_reported_skills
  FOR SELECT USING (
    current_user_role() = 'employer' AND NOT current_user_is_guest()
    AND has_verification(student_id)
  );

-- No UPDATE policy and no confirm RPC -- there's nothing left to
-- transition between states, a row is complete the moment it's
-- inserted (and insertion itself requires evidence_file_path).


-- ============================================================
-- "Upload work students already do" -- distinguishes these work_items
-- rows from ordinary briefs (both are type='brief', created via
-- different forms) so the Briefs screen can show two separate lists
-- instead of mixing them together.
-- ============================================================
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS is_existing_work boolean NOT NULL DEFAULT false;
