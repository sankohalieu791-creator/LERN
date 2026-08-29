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
  meta: { role: 'student' | 'institution_staff' | 'provider_staff' | 'employer'; full_name: string; date_of_birth?: string }
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

// Used only to bootstrap an organisation's very first code at signup,
// before staff have had a chance to pick their own — JoinCodesPanel
// itself always takes a staff-chosen code, never calls this.
export const randomJoinCode = () =>
  Array.from({ length: 6 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]).join('')

// Screen O3 — staff choose their own code (4-6 characters) rather than
// getting a random string, so it's actually memorable/writable on a
// whiteboard. Defaults to a 2-week expiry unless the caller overrides
// it. A collision surfaces as a clear error rather than silently
// generating something else — the whole point is the code is theirs.
export const generateJoinCode = async (organisationId: string, createdBy: string, code: string, expiresAt?: string | null) => {
  const normalized = code.trim().toUpperCase()
  const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('join_codes')
    .insert([{ organisation_id: organisationId, code: normalized, created_by: createdBy, expires_at: expiresAt !== undefined ? expiresAt : defaultExpiry }])
    .select()
    .single()
  if (error && (error as any).message?.includes('duplicate')) {
    return { data: null, error: { message: 'That code is already in use — try a different one.' } as any }
  }
  return { data, error }
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
    mode?: 'online' | 'in_person'; location?: string; starts_at?: string | null
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

// Staff-only — revoke/withdraw a brief, course, or workshop. Never a
// delete: a student's submissions/verifications against it stay intact
// and reviewable, it just stops being offered to students from here on.
// .select().single() is deliberate here, not decoration — an UPDATE
// that RLS silently narrows to zero matching rows still comes back as
// { error: null } from a bare .update(), so a caller with no
// organisation_id match (e.g. the work item belongs to a different
// org) would look like it worked and just... not do anything. Asking
// for the row back turns that into a real, visible error.
export const closeWorkItem = async (workItemId: string) => {
  const { data, error } = await supabase.from('work_items').update({ closed_at: new Date().toISOString() }).eq('id', workItemId).select().single()
  if (!error && !data) return { error: { message: "Couldn't revoke this — it may not belong to your organisation." } as any }
  return { error }
}

export const reopenWorkItem = async (workItemId: string) => {
  const { data, error } = await supabase.from('work_items').update({ closed_at: null }).eq('id', workItemId).select().single()
  if (!error && !data) return { error: { message: "Couldn't reopen this — it may not belong to your organisation." } as any }
  return { error }
}

// Staff-only, called the moment the host actually opens the room —
// records started_at and fans out a "session has started, join now"
// notification (first time only; rejoining doesn't re-notify).
export const startWorkItemSession = async (workItemId: string) => {
  const { error } = await supabase.rpc('start_work_item_session', { p_work_item_id: workItemId })
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
export const getSignedFileUrl = async (bucket: 'submission-files' | 'work-item-attachments' | 'post-images' | 'session-recordings', path: string) => {
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
// Reactions can't be embedded through posts_feed (it's a view, not an
// FK-linked table PostgREST can auto-join) — fetched separately and
// merged in here instead.
const attachReactions = async (posts: any[]) => {
  if (posts.length === 0) return posts
  const { data: reactions } = await supabase
    .from('post_reactions')
    .select('id, post_id, user_id, reaction')
    .in('post_id', posts.map(p => p.id))
  const byPost = new Map<string, any[]>()
  for (const r of reactions || []) byPost.set(r.post_id, [...(byPost.get(r.post_id) || []), r])
  return posts.map(p => ({ ...p, post_reactions: byPost.get(p.id) || [] }))
}

// posts_feed pre-computes author_name/author_anonymised server-side
// (see 2026-08-28-feed-under18-anonymity.sql) -- an under-18 author's
// real name never leaves the database for a viewer outside their org.
export const getFeed = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
    .or(`organisation_id.eq.${organisationId},visibility.eq.public`)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return { data, error }
  return { data: await attachReactions(data), error: null }
}

// Explore mode (no organisation yet): "a public, safe educational feed —
// LERN's own and general educational content only." RLS already limits
// an org-less caller to public posts regardless, this just avoids
// passing a null organisation_id into the .or() filter above.
export const getPublicFeed = async () => {
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
    .eq('visibility', 'public')
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return { data, error }
  return { data: await attachReactions(data), error: null }
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

// ── In-app notifications ─────────────────────────────────────────
export const getMyNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, read, created_at, submissions(work_items(title)), work_items(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  return { data, error }
}

export const getUnreadNotificationCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  return { count: count || 0, error }
}

export const markNotificationRead = async (id: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  return { error }
}

export const markAllNotificationsRead = async (userId: string) => {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  return { error }
}

// ── Live-session chat / Q&A ─────────────────────────────────────
export const getWorkshopMessages = async (workItemId: string) => {
  const { data, error } = await supabase
    .from('workshop_messages')
    .select('id, sender_id, kind, content, created_at, users(full_name)')
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })
    .limit(200)
  return { data, error }
}

export const sendWorkshopMessage = async (workItemId: string, senderId: string, kind: 'chat' | 'question', content: string) => {
  const { error } = await supabase.from('workshop_messages').insert([{ work_item_id: workItemId, sender_id: senderId, kind, content }])
  return { error }
}

export const setPresenceStatus = async (userId: string, status: 'active' | 'busy' | 'away') => {
  const { error } = await supabase.from('users').update({ presence_status: status }).eq('id', userId)
  return { error }
}

// ── Session recording ────────────────────────────────────────────
export const startRecording = async (workItemId: string, userId: string) => {
  const res = await fetch('/api/recording/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workItemId, userId }),
  })
  const data = await res.json()
  return { recordingId: data.recordingId as string | undefined, error: res.ok ? null : data }
}

export const stopRecording = async (recordingId: string) => {
  const res = await fetch('/api/recording/stop', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordingId }),
  })
  const data = await res.json()
  return { error: res.ok ? null : data }
}

export const getWorkItemRecordings = async (workItemId: string) => {
  const { data, error } = await supabase
    .from('work_item_recordings')
    .select('*')
    .eq('work_item_id', workItemId)
    .order('started_at', { ascending: false })
  return { data, error }
}

// ── Employer: Discover ───────────────────────────────────────────
// Only rows the student themselves chose to make public reach here —
// RLS enforces this independently (an employer session literally
// cannot read an organisation-only verification), this query just
// mirrors that boundary. Never selects the student's email or DOB —
// RLS controls which ROWS an employer can read, not which COLUMNS, so
// "no contact details" for a minor is enforced here at the query
// level, deliberately, not left to chance.
export const getDiscoverWork = async (filters?: { type?: string; q?: string }) => {
  let query = supabase
    .from('verifications')
    .select(`
      id, verified_at, submission_id,
      verifier:users!verifications_verified_by_fkey(full_name),
      submissions!inner(
        id, content, student_id,
        student:users!submissions_student_id_fkey(id, full_name),
        work_items!inner(id, title, description, type)
      )
    `)
    .eq('visibility', 'public')
    .is('revoked_at', null)
    .order('verified_at', { ascending: false })
    .limit(60)

  if (filters?.type) query = query.eq('submissions.work_items.type', filters.type)
  if (filters?.q) query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`, { referencedTable: 'submissions.work_items' })

  const { data, error } = await query
  return { data, error }
}

// One row per (employer, student) — checked before showing "Express
// interest" so an employer sees the status of interest they've
// already raised instead of a button that silently no-ops or a
// duplicate row. Never contact info: this table only ever carries a
// status, never a channel to reach the student directly.
export const getMyInterest = async (employerId: string) => {
  const { data, error } = await supabase.from('interest').select('*').eq('employer_id', employerId)
  return { data, error }
}

export const expressInterest = async (employerId: string, studentId: string) => {
  const { data, error } = await supabase
    .from('interest')
    .insert([{ employer_id: employerId, student_id: studentId }])
    .select()
    .single()
  return { data, error }
}

// ── Employer: Opportunities ──────────────────────────────────────
export const getMyOpportunities = async (employerId: string) => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createOpportunity = async (employerId: string, fields: { title: string; description?: string }) => {
  const { data, error } = await supabase
    .from('opportunities')
    .insert([{ employer_id: employerId, ...fields }])
    .select()
    .single()
  return { data, error }
}

export const deleteOpportunity = async (id: string) => {
  const { error } = await supabase.from('opportunities').delete().eq('id', id)
  return { error }
}

// ── Guest employer invite (Type 1 — org-invited, scoped to one
// student, no browsing beyond what's explicitly shared) ──────────

// Org staff: create an invite scoped to one student, in one step —
// there's no reason to split "create the invite" from "pick who it's
// for" into two screens for the simple, most-common case.
export const createGuestInviteForStudent = async (organisationId: string, createdBy: string, studentId: string) => {
  const token = crypto.randomUUID()
  const { data: invite, error } = await supabase
    .from('guest_invites')
    .insert([{ organisation_id: organisationId, created_by: createdBy, token }])
    .select()
    .single()
  if (error || !invite) return { data: null, error }
  const { error: shareError } = await supabase
    .from('guest_invite_shares')
    .insert([{ invite_id: (invite as any).id, student_id: studentId }])
  if (shareError) return { data: null, error: shareError }
  return { data: invite, error: null }
}

export const getGuestInvites = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('guest_invites')
    .select('*, guest_invite_shares(student_id, verification_id, users:student_id(full_name))')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const revokeGuestInvite = async (id: string) => {
  const { error } = await supabase.from('guest_invites').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  return { error }
}

// Public lookup (unauthenticated) — the claim page needs to show who
// invited them before any session exists, so this goes through a
// service-role API route rather than a client RLS read.
export const getGuestInviteInfo = async (token: string) => {
  const res = await fetch(`/api/guest/invite/${encodeURIComponent(token)}`)
  const data = await res.json()
  return { data: res.ok ? data : null, error: res.ok ? null : data }
}

// Magic-link sign-in, not a password — "click it and get a guest
// pass" is the whole point; guest_invite_id in metadata is what lets
// handle_new_user() punch through the founder allowlist, but only
// because it re-validates that id server-side against a real,
// unclaimed, unrevoked row before trusting it.
export const claimGuestInvite = async (inviteId: string, fullName: string, email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: { role: 'employer', full_name: fullName, guest_invite_id: inviteId },
      emailRedirectTo: `${window.location.origin}/guest/confirm`,
    },
  })
  return { error }
}

// Guest's own scoped view once signed in — RLS (guest_can_see_*)
// already narrows this to exactly what was shared, so no extra
// filtering needed here beyond what an independent employer's
// Discover query does for the public case.
export const getGuestSharedWork = async () => {
  const { data, error } = await supabase
    .from('verifications')
    .select(`
      id, verified_at, submission_id,
      verifier:users!verifications_verified_by_fkey(full_name),
      submissions!inner(
        id, content, student_id,
        student:users!submissions_student_id_fkey(id, full_name),
        work_items!inner(id, title, description, type)
      )
    `)
    .is('revoked_at', null)
    .order('verified_at', { ascending: false })
  return { data, error }
}

// ── Dev login (testing stage only — see app/api/dev-login) ───────
// No password: a shared secret (set once, kept in this browser) plus
// the DB's own allowlist check stand in for one. token_hash comes
// back from an admin-generated magic link that's exchanged for a real
// session here, without ever sending an actual email.
export const devLogin = async (email: string, secret: string) => {
  const res = await fetch('/api/dev-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, secret }),
  })
  const body = await res.json()
  if (!res.ok) return { error: body }
  const { error } = await supabase.auth.verifyOtp({ email, token_hash: body.tokenHash, type: 'magiclink' })
  return { error }
}
