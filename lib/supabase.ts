import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth (v2) — the on_auth_user_created DB trigger creates the public.users
// row (role/full_name/email/date_of_birth) the instant signUp succeeds, from
// the metadata passed here. A client-side insert would race session
// hydration and get blocked by RLS, so we never attempt one directly.
export const signUp = async (
  email: string,
  password: string,
  meta: { role: 'student' | 'institution_staff' | 'provider_staff'; full_name: string; date_of_birth?: string }
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  })
  return { data, error }
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Screen A2 — join an organisation by code. Requires an active session
// (redeem_join_code() writes to the caller's own row via auth.uid()).
// Throws via `error` on an invalid/expired/revoked code — never partially
// succeeds.
export const redeemJoinCode = async (code: string) => {
  const { data, error } = await supabase.rpc('redeem_join_code', { p_code: code.trim() })
  return { data: data as string | null, error }
}

// Screen O1/O3 — self-serve organisation sign-up: creates the org, makes
// the calling user its staff member (institution_staff/provider_staff
// depending on type), and names them safeguarding lead by default.
export const createOrganisationAndJoin = async (name: string, type: 'institution' | 'provider', fullName: string) => {
  const { data, error } = await supabase.rpc('create_organisation_and_join', {
    p_name: name, p_type: type, p_full_name: fullName,
  })
  return { data: data as string | null, error }
}

// Screens A3/O2 — active, non-pre-ticked consent.
export const recordConsent = async (userId: string) => {
  const { error } = await supabase
    .from('users')
    .update({ consented_at: new Date().toISOString() })
    .eq('id', userId)
  return { error }
}

// Screen O3 — generate a join code for the caller's own organisation.
// Retries on the rare code collision (unique constraint).
export const generateJoinCode = async (organisationId: string, createdBy: string, expiresAt?: string | null) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 8 }, () =>
      '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]
    ).join('')
    const { data, error } = await supabase
      .from('join_codes')
      .insert([{ organisation_id: organisationId, code, created_by: createdBy, expires_at: expiresAt ?? null }])
      .select()
      .single()
    if (!error) return { data, error: null }
    if (!(error as any).message?.includes('duplicate')) return { data: null, error }
  }
  return { data: null, error: { message: 'Could not generate a unique code — please try again.' } as any }
}

export const listJoinCodes = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('join_codes')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const revokeJoinCode = async (codeId: string) => {
  const { error } = await supabase.from('join_codes').update({ revoked: true }).eq('id', codeId)
  return { error }
}

// ── Verify loop (v2) ────────────────────────────────────────────

// Org staff: briefs/courses they've set for their organisation.
export const getWorkItems = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createWorkItem = async (
  organisationId: string, createdBy: string,
  fields: { type: 'brief' | 'course' | 'workshop'; title: string; description?: string; criteria: string; visibility?: 'public' | 'private' }
) => {
  const { data, error } = await supabase
    .from('work_items')
    .insert([{ organisation_id: organisationId, created_by: createdBy, visibility: 'private', ...fields }])
    .select()
    .single()
  return { data, error }
}

// Student: every work item their own organisation has open to them.
export const getVisibleWorkItems = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Student: every submission they've made, most recent first, with the
// work item's title/criteria and (if verified) the tick's details.
export const getMySubmissions = async (studentId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, work_items(title, criteria), verifications(id, verified_by, verified_at, visibility, revoked_at)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
  return { data, error }
}

export const submitWork = async (studentId: string, workItemId: string, content: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .insert([{ student_id: studentId, work_item_id: workItemId, content }])
    .select()
    .single()
  return { data, error }
}

// Org staff: everything submitted against their org's work items,
// newest first — the review queue.
export const getReviewQueue = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, users(full_name), work_items!inner(title, criteria, organisation_id)')
    .eq('work_items.organisation_id', organisationId)
    .order('submitted_at', { ascending: false })
  return { data, error }
}

// The one write that drives the whole loop — see handle_review_decision()
// in the DB: this single insert cascades to submissions.status, a
// verifications row (or its revoke fields), and a notification, all in
// the same transaction.
export const submitReview = async (
  submissionId: string, reviewerId: string, decision: 'verified' | 'returned' | 'revoked', feedback: string
) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert([{ submission_id: submissionId, reviewer_id: reviewerId, decision, feedback: feedback || null }])
    .select()
    .single()
  return { data, error }
}

export const setModeration = async (submissionId: string, status: 'clear' | 'flagged' | 'hidden', reason?: string) => {
  const { error } = await supabase
    .from('submissions')
    .update({ moderation_status: status, flagged_reason: reason || null })
    .eq('id', submissionId)
  return { error }
}

// Student: choose who can see a piece of verified work. The DB trigger
// is the actual enforcement — under-18 is rejected there regardless of
// what's sent here, this just surfaces that outcome to the caller.
export const setShareVisibility = async (verificationId: string, visibility: 'organisation' | 'public') => {
  const { error } = await supabase
    .from('verifications')
    .update({ visibility })
    .eq('id', verificationId)
  return { error }
}

// Institution "Students" section: the org's students with a rollup of
// their submitted/verified work counts (enrolment + progress; attendance
// tracking isn't built yet).
export const getOrgStudents = async (organisationId: string) => {
  const { data: students, error } = await supabase
    .from('users')
    .select('id, full_name, email, created_at')
    .eq('organisation_id', organisationId)
    .eq('role', 'student')
    .order('full_name')
  if (error || !students) return { data: null, error }

  const ids = students.map(s => s.id)
  const { data: subs } = ids.length
    ? await supabase.from('submissions').select('student_id, status').in('student_id', ids)
    : { data: [] as any[] }

  const counts: Record<string, { submitted: number; verified: number }> = {}
  for (const s of subs || []) {
    counts[s.student_id] ??= { submitted: 0, verified: 0 }
    counts[s.student_id].submitted++
    if (s.status === 'verified') counts[s.student_id].verified++
  }

  return { data: students.map(s => ({ ...s, ...(counts[s.id] || { submitted: 0, verified: 0 }) })), error: null }
}

// Sidebar collapsed/expanded state — remembered server-side per the org
// layout spec, not browser-only (localStorage), so it follows the user
// across devices/logins.
export const setSidebarCollapsed = async (userId: string, collapsed: boolean) => {
  const { error } = await supabase.from('users').update({ sidebar_collapsed: collapsed }).eq('id', userId)
  return { error }
}


// Users
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
  if (!error && (!data || (data as any[]).length === 0)) {
    return { data: null, error: { message: 'Could not save profile — please sign out and back in, then try again.' } as any }
  }
  return { data, error }
}
