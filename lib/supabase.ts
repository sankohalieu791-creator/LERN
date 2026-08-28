import { createClient } from '@supabase/supabase-js'
import type { ReactionType } from '@/lib/types'

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
    .select('*, groups(name), work_item_attachments(id, file_name, file_path, file_size_bytes)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createWorkItem = async (
  organisationId: string, createdBy: string,
  fields: {
    type: 'brief' | 'course' | 'workshop'; title: string; description?: string; criteria: string
    visibility?: 'public' | 'private'; topic?: string; assignment?: string; deadline?: string | null; group_id?: string | null
    mode?: 'online' | 'in_person'; location?: string
  }
) => {
  const { data, error } = await supabase
    .from('work_items')
    .insert([{ organisation_id: organisationId, created_by: createdBy, visibility: 'private', ...fields }])
    .select()
    .single()
  return { data, error }
}

// Attachments a tutor adds to a brief when creating it (slides, docs,
// resources) — org-scoped read, staff-only write, enforced by RLS.
export const uploadWorkItemAttachment = async (workItemId: string, uploadedBy: string, file: File) => {
  const path = `${workItemId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('work-item-attachments').upload(path, file)
  if (uploadError) return { data: null, error: uploadError }
  const { data, error } = await supabase
    .from('work_item_attachments')
    .insert([{ work_item_id: workItemId, file_path: path, file_name: file.name, file_size_bytes: file.size, uploaded_by: uploadedBy }])
    .select()
    .single()
  return { data, error }
}

// Staff-only, ends an online workshop for everyone — after this the card
// shows "Ended" instead of still inviting people to start/join. Uses the
// existing "work_items: staff update" RLS policy, no new policy needed.
export const endWorkshop = async (workItemId: string) => {
  const { error } = await supabase.from('work_items').update({ ended_at: new Date().toISOString() }).eq('id', workItemId)
  return { error }
}

export const getWorkItemAttachments = async (workItemId: string) => {
  const { data, error } = await supabase
    .from('work_item_attachments')
    .select('*')
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })
  return { data, error }
}

// Both submission-files and work-item-attachments are private buckets --
// a signed URL is the only way to actually view/download an object.
export const getSignedFileUrl = async (bucket: 'submission-files' | 'work-item-attachments' | 'post-images', path: string) => {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  return { url: data?.signedUrl ?? null, error }
}

// Student: every work item their own organisation has open to them
// (RLS already narrows this to their group + org-wide/ungrouped items).
export const getVisibleWorkItems = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('work_items')
    .select('*, work_item_attachments(id, file_name, file_path, file_size_bytes)')
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

// Uploads to the student's own folder in the private submission-files
// bucket — RLS only lets a student upload under their own auth.uid()
// prefix (already enforced by the "owner upload" storage policy).
export const uploadSubmissionFile = async (studentId: string, file: File) => {
  const path = `${studentId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('submission-files').upload(path, file)
  return { path: error ? null : path, error }
}

export const submitWork = async (
  studentId: string, workItemId: string, content: string, file?: { path: string; type: string; size: number }
) => {
  const { data, error } = await supabase
    .from('submissions')
    .insert([{
      student_id: studentId, work_item_id: workItemId, content: content || null,
      ...(file ? { file_path: file.path, file_type: file.type, file_size_bytes: file.size } : {}),
    }])
    .select()
    .single()
  return { data, error }
}

// Briefs "Upload existing work" — org staff attach coursework a student (or
// several) already produced elsewhere as a submission ready to verify,
// skipping the "student submits it themselves" step. Same submissions
// table/RLS-checked insert as submitWork, just with student_id set to
// someone other than the caller — allowed by the org-staff insert policy
// in 2026-08-27-org-sections-build.sql. One insert per student so a
// moderation/review decision on one doesn't affect the others.
// Staff-side upload into a student's own submission-files folder — allowed
// by the "org staff upload for student" storage policy, scoped to
// students actually in the caller's org.
export const uploadSubmissionFileFor = async (studentId: string, file: File) => {
  const path = `${studentId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('submission-files').upload(path, file)
  return { path: error ? null : path, error }
}

export const submitWorkForStudents = async (
  studentIds: string[], workItemId: string, content: string, file?: { path: string; type: string; size: number }
) => {
  const { data, error } = await supabase
    .from('submissions')
    .insert(studentIds.map(student_id => ({
      student_id, work_item_id: workItemId, content: content || null,
      ...(file ? { file_path: file.path, file_type: file.type, file_size_bytes: file.size } : {}),
    })))
    .select()
  return { data, error }
}

// Org staff: everything submitted against their org's work items, oldest
// first — the review queue works oldest-waiting-first so nothing sits
// forgotten at the bottom.
export const getReviewQueue = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, users(full_name), work_items!inner(title, criteria, organisation_id)')
    .eq('work_items.organisation_id', organisationId)
    .order('submitted_at', { ascending: true })
  return { data, error }
}

// Org staff, mid-review: a student's past review decisions across all
// their submissions, for context on the submission currently open —
// requires the reviews RLS widen in 2026-08-27-org-sections-build.sql
// (previously a reviewer could only see reviews they personally wrote).
export const getStudentReviewHistory = async (studentId: string, excludeSubmissionId?: string) => {
  let query = supabase
    .from('reviews')
    .select('id, decision, feedback, created_at, submission_id, users(full_name), submissions!inner(student_id, work_items(title))')
    .eq('submissions.student_id', studentId)
    .order('created_at', { ascending: false })
  if (excludeSubmissionId) query = query.neq('submission_id', excludeSubmissionId)
  const { data, error } = await query
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
// their submitted/verified work counts and their group (enrolment + progress).
export const getOrgStudents = async (organisationId: string) => {
  const { data: students, error } = await supabase
    .from('users')
    .select('id, full_name, email, created_at, group_id, groups(name)')
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

// ── Groups (classes) ────────────────────────────────────────────
export const getGroups = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name')
  return { data, error }
}

export const getGroupMembers = async (groupId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('group_id', groupId)
    .eq('role', 'student')
    .order('full_name')
  return { data, error }
}

export const createGroup = async (organisationId: string, createdBy: string, name: string) => {
  const { data, error } = await supabase
    .from('groups')
    .insert([{ organisation_id: organisationId, created_by: createdBy, name }])
    .select()
    .single()
  return { data, error }
}

// Staff-only re-assignment, via the set_student_group() RPC — the tamper
// guard on users.group_id means a direct client PATCH is blocked, this is
// the only legitimate write path.
export const setStudentGroup = async (studentId: string, groupId: string) => {
  const { error } = await supabase.rpc('set_student_group', { p_student_id: studentId, p_group_id: groupId })
  return { error }
}

// ── Attendance register ─────────────────────────────────────────
// One row per student for a given group+session date. Staff-marked only.
export const getAttendanceForSession = async (groupId: string, sessionDate: string) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('group_id', groupId)
    .eq('session_date', sessionDate)
  return { data, error }
}

export const markAttendance = async (
  groupId: string, studentId: string, sessionDate: string, status: 'present' | 'absent' | 'late', markedBy: string
) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert([{ group_id: groupId, student_id: studentId, session_date: sessionDate, status, marked_by: markedBy, updated_at: new Date().toISOString() }],
      { onConflict: 'group_id,student_id,session_date' })
    .select()
    .single()
  return { data, error }
}

// A student's overall attendance summary — percentage present over every
// session they've been marked for, shown on their detail page.
export const getStudentAttendanceSummary = async (studentId: string) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status')
    .eq('student_id', studentId)
  if (error || !data) return { data: null, error }
  const total = data.length
  const present = data.filter(r => r.status === 'present').length
  const late = data.filter(r => r.status === 'late').length
  return { data: { total, present, late, absent: total - present - late, percentPresent: total ? Math.round(((present + late) / total) * 100) : null }, error: null }
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

// ── Feed ──────────────────────────────────────────────────────
// Org-wide + any public posts, newest first. RLS already narrows this to
// what the caller's allowed to see.
export const getFeed = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, users(full_name, role), post_reactions(id, user_id, reaction)')
    .or(`organisation_id.eq.${organisationId},visibility.eq.public`)
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

// Explore mode (no organisation yet): "a public, safe educational feed —
// LERN's own and general educational content only." RLS already limits
// an org-less caller to public posts regardless, this just avoids
// passing a null organisation_id into the .or() filter above.
export const getPublicFeed = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, users(full_name, role), post_reactions(id, user_id, reaction)')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

export const uploadPostImage = async (userId: string, file: File) => {
  const path = `${userId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('post-images').upload(path, file)
  return { path: error ? null : path, error }
}

export const createPost = async (
  organisationId: string, authorId: string,
  fields: { content?: string; image_path?: string; visibility?: 'organisation' | 'public' }
) => {
  const { data, error } = await supabase
    .from('posts')
    .insert([{ organisation_id: organisationId, author_id: authorId, visibility: 'organisation', ...fields }])
    .select()
    .single()
  return { data, error }
}

export const deletePost = async (postId: string) => {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  return { error }
}

// One reaction per user per post — upsert swaps it if they tap a
// different one, and tapping the same one again removes it.
export const setPostReaction = async (postId: string, userId: string, reaction: ReactionType | null) => {
  if (reaction === null) {
    const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId)
    return { error }
  }
  const { error } = await supabase
    .from('post_reactions')
    .upsert([{ post_id: postId, user_id: userId, reaction }], { onConflict: 'post_id,user_id' })
  return { error }
}

// ── Settings: account ────────────────────────────────────────────
export const changePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error }
}

export const setThemePreference = async (userId: string, theme: 'light' | 'dark' | 'system') => {
  const { error } = await supabase.from('users').update({ theme_preference: theme }).eq('id', userId)
  return { error }
}

export const setNotificationPrefs = async (userId: string, prefs: Record<string, boolean>) => {
  const { error } = await supabase.from('users').update({ notification_prefs: prefs }).eq('id', userId)
  return { error }
}

// GDPR "download my data" — every table that references this user,
// bundled into one object. Read-only, RLS already scopes every query to
// rows the caller is allowed to see (which for their own id is everything).
export const exportMyData = async (userId: string) => {
  const [profile, submissions, reviewsWritten, verifications, posts, reactions, attendance] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('submissions').select('*').eq('student_id', userId),
    supabase.from('reviews').select('*').eq('reviewer_id', userId),
    supabase.from('verifications').select('*, submissions!inner(student_id)').eq('submissions.student_id', userId),
    supabase.from('posts').select('*').eq('author_id', userId),
    supabase.from('post_reactions').select('*').eq('user_id', userId),
    supabase.from('attendance_records').select('*').eq('student_id', userId),
  ])
  return {
    profile: profile.data,
    submissions: submissions.data || [],
    reviews_written: reviewsWritten.data || [],
    verifications: verifications.data || [],
    posts: posts.data || [],
    reactions: reactions.data || [],
    attendance: attendance.data || [],
    exported_at: new Date().toISOString(),
  }
}

// GDPR "delete my account and data" — cascades through everything via
// delete_my_account()'s DELETE FROM auth.users.
export const deleteMyAccount = async () => {
  const { error } = await supabase.rpc('delete_my_account')
  return { error }
}

// ── Settings: organisation admin ──────────────────────────────────
export const updateOrganisationProfile = async (organisationId: string, updates: { name?: string; safeguarding_lead_id?: string }) => {
  const { error } = await supabase.from('organisations').update(updates).eq('id', organisationId)
  return { error }
}

export const getOrgStaff = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, created_at')
    .eq('organisation_id', organisationId)
    .in('role', ['institution_staff', 'provider_staff'])
    .order('full_name')
  return { data, error }
}

// ── Reporting ───────────────────────────────────────────────────
export const submitReport = async (
  reporterId: string, organisationId: string | null,
  targetType: 'post' | 'user' | 'submission' | 'general', reason: string, targetId?: string
) => {
  const { data, error } = await supabase
    .from('reports')
    .insert([{ reporter_id: reporterId, organisation_id: organisationId, target_type: targetType, target_id: targetId || null, reason }])
    .select()
    .single()
  return { data, error }
}

export const getOrgReports = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, users!reports_reporter_id_fkey(full_name)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const resolveReport = async (reportId: string, reviewerId: string, status: 'reviewed' | 'dismissed' | 'actioned') => {
  const { error } = await supabase
    .from('reports')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reportId)
  return { error }
}
