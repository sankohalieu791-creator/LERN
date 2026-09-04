import { createClient } from '@supabase/supabase-js'
import type { ReactionType, Role } from '@/lib/types'

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

// Dashboard's "Previous courses/workshops" — an ended session moves
// here instead of staying in the live Workshops/Courses list.
export const getEndedWorkItems = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('work_items')
    .select('id, type, title, ended_at')
    .eq('organisation_id', organisationId)
    .in('type', ['workshop', 'course'])
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(20)
  return { data, error }
}

export const createWorkItem = async (
  organisationId: string, createdBy: string,
  fields: {
    type: 'brief' | 'course' | 'workshop'; title: string; description?: string; criteria: string
    visibility?: 'public' | 'private'; topic?: string; assignment?: string; deadline?: string | null; group_id?: string | null
    mode?: 'online' | 'in_person'; location?: string; starts_at?: string | null
    // Briefs only, Classroom-shaped: post immediately, hold as a draft
    // only staff can see, or publish automatically once scheduled_for
    // arrives (RLS reads scheduled_for at query time -- no cron job).
    // Courses/Workshops never pass these, so they stay the default
    // 'posted', unaffected.
    publish_state?: 'draft' | 'scheduled' | 'posted'; scheduled_for?: string | null
  }
) => {
  const { data, error } = await supabase
    .from('work_items')
    .insert([{ organisation_id: organisationId, created_by: createdBy, visibility: 'private', ...fields }])
    .select()
    .single()
  return { data, error }
}

// Brief status roll-up (Classroom-style): "New / Submitted / Verified /
// Returned / Overdue", rolled up per brief across everyone it's assigned
// to. "In progress" (opened but not submitted) isn't tracked anywhere in
// this schema -- a submission row only exists once work is actually
// turned in -- so that state is deliberately not claimed here rather
// than faked from data that doesn't exist yet.
export const getBriefStatusSummaries = async (
  workItems: { id: string; group_id?: string | null; deadline?: string | null }[],
  organisationId: string,
): Promise<Record<string, { assigned: number; submitted: number; verified: number; returned: number; overdue: boolean }>> => {
  const ids = workItems.map(w => w.id)
  if (ids.length === 0) return {}

  const [{ data: subs }, { data: students }] = await Promise.all([
    supabase.from('submissions').select('work_item_id, student_id, status').in('work_item_id', ids),
    supabase.from('users').select('id, group_id').eq('organisation_id', organisationId).eq('role', 'student'),
  ])

  const out: Record<string, { assigned: number; submitted: number; verified: number; returned: number; overdue: boolean }> = {}
  for (const w of workItems) {
    const assignedStudents = (students || []).filter(s => !w.group_id || s.group_id === w.group_id)
    const itemSubs = (subs || []).filter(s => s.work_item_id === w.id)
    const submittedIds = new Set(itemSubs.map(s => s.student_id))
    const verified = itemSubs.filter(s => s.status === 'verified').length
    const returned = itemSubs.filter(s => s.status === 'returned').length
    const isOverdue = !!w.deadline && new Date(w.deadline) < new Date() && submittedIds.size < assignedStudents.length
    out[w.id] = { assigned: assignedStudents.length, submitted: submittedIds.size, verified, returned, overdue: isOverdue }
  }
  return out
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
export const getSignedFileUrl = async (bucket: 'submission-files' | 'work-item-attachments' | 'post-images' | 'post-videos' | 'session-recordings' | 'self-qualifications', path: string) => {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  return { url: data?.signedUrl ?? null, error }
}

// Student: every work item their own organisation has open to them
// (RLS already narrows this to their group + org-wide/ungrouped items).
export const getVisibleWorkItems = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('work_items')
    .select('*, work_item_attachments(id, file_name, file_path, file_size_bytes), users!work_items_created_by_fkey(full_name), organisations(name, logo_path, verified)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// A student can't read `organisations.type` directly (RLS deliberately
// keeps it staff-only), but My Work's tab set depends on it — this is
// the one narrow read path in for the caller's own org.
export const getMyOrgType = async (): Promise<'institution' | 'provider' | null> => {
  const { data } = await supabase.rpc('my_org_type')
  return (data as any) ?? null
}

// Headcount only (no names/rows) — same audience the work item is
// already visible to. See work_item_member_count() for why this has
// to be an RPC rather than a direct users query.
export const getWorkItemMemberCount = async (workItemId: string): Promise<number> => {
  const { data } = await supabase.rpc('work_item_member_count', { p_work_item_id: workItemId })
  return (data as any) ?? 0
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

// My Work "In progress" state -- the only real signal that a piece
// has been opened/begun but not yet submitted. Written once (upsert,
// not insert -- opening the same item again shouldn't error), read as
// a plain set of work_item_ids to check against.
export const markWorkItemStarted = async (workItemId: string, studentId: string) => {
  const { error } = await supabase.from('work_item_starts').upsert([{ work_item_id: workItemId, student_id: studentId }], { onConflict: 'work_item_id,student_id' })
  return { error }
}
export const getMyStartedWorkItemIds = async (studentId: string) => {
  const { data, error } = await supabase.from('work_item_starts').select('work_item_id').eq('student_id', studentId)
  return { data: (data || []).map(r => r.work_item_id), error }
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

// Lightweight counts for the mobile nav drawer's badges -- head:true
// so it's a row count, not the actual rows, on every OrgShell mount.
export const getPendingReviewCount = async (organisationId: string) => {
  const { count, error } = await supabase
    .from('submissions')
    .select('id, work_items!inner(organisation_id)', { count: 'exact', head: true })
    .eq('work_items.organisation_id', organisationId)
    .eq('status', 'submitted')
  return { count: count || 0, error }
}

export const getPendingInterestCount = async () => {
  const { count, error } = await supabase
    .from('interest')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return { count: count || 0, error }
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
  const ids = posts.map(p => p.id)
  const [{ data: reactions }, { data: likes }] = await Promise.all([
    supabase.from('post_reactions').select('id, post_id, user_id, reaction').in('post_id', ids),
    supabase.from('post_likes').select('id, post_id, user_id').in('post_id', ids),
  ])
  const reactionsByPost = new Map<string, any[]>()
  for (const r of reactions || []) reactionsByPost.set(r.post_id, [...(reactionsByPost.get(r.post_id) || []), r])
  const likesByPost = new Map<string, any[]>()
  for (const l of likes || []) likesByPost.set(l.post_id, [...(likesByPost.get(l.post_id) || []), l])
  return posts.map(p => ({ ...p, post_reactions: reactionsByPost.get(p.id) || [], post_likes: likesByPost.get(p.id) || [] }))
}

// A real Like, separate from the 4-sticker reaction set -- a user can
// hold both at once (one like, one reaction), unlike reactions which
// are one-per-user-per-post by design.
export const toggleLike = async (postId: string, userId: string, liked: boolean) => {
  if (liked) {
    const { error } = await supabase.from('post_likes').insert([{ post_id: postId, user_id: userId }])
    return { error }
  }
  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  return { error }
}

// posts_feed pre-computes author_name/author_anonymised server-side
// (see 2026-08-28-feed-under18-anonymity.sql) -- an under-18 author's
// real name never leaves the database for a viewer outside their org.
// Feed's search icon -- searches title/content/category across
// whatever the caller can already see (posts_feed runs with
// security_invoker now, so RLS -- "posts: read" -- is what actually
// scopes this, same open-to-everyone model as getFeed), not a
// separate unrestricted table scan.
// "For both searching video and people" -- search_people is a
// SECURITY DEFINER RPC (see migration) since a student can't SELECT
// another student's users row directly under RLS; it applies its own
// narrow visibility rule instead (same org, or already shown
// un-anonymised somewhere in the Feed).
export const searchPeople = async (query: string) => {
  const q = query.trim()
  if (!q) return { data: [], error: null }
  const { data, error } = await supabase.rpc('search_people', { q })
  return { data: data as { id: string; full_name: string; avatar_path: string | null; role: string }[] | null, error }
}

export const searchPosts = async (query: string) => {
  const q = query.trim()
  if (!q) return { data: [], error: null }
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
    .eq('hidden', false)
    .or(`content.ilike.%${q}%,title.ilike.%${q}%,category.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error || !data) return { data, error }
  return { data: await attachReactions(data), error: null }
}

// Powers the "more from this person" list under Feed's fullscreen
// video player -- YouTube-style tap-to-open, but the videos listed
// below are only ever this same author's, not an algorithmic mix of
// everyone else's like YouTube's own "up next" would be. hidden posts
// stay excluded, same as the feed itself.
export const getPostsByAuthor = async (authorId: string, excludePostId: string) => {
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
    .eq('author_id', authorId)
    .not('video_path', 'is', null)
    .neq('id', excludePostId)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(20)
  return { data, error }
}

// "Everyone can see it, don't limit it" -- no org/public scoping here
// any more; institution and provider students see each other's posts,
// and an org-less/employer viewer sees the same feed too. hidden posts
// are NOT filtered out here on purpose -- posts_feed now runs with
// security_invoker, so RLS on the underlying posts table ("posts:
// read") is what actually decides who gets a hidden row back at all
// (the post's own author, always; that org's own staff, always;
// everyone else, never -- a hidden post simply isn't in their results
// any more, this isn't just a client-side filter). That lets the
// author still see their own post (rendered as the neutral "hidden
// while checked" placeholder, see FeedPanel) instead of it just
// vanishing on them with no explanation, while a hidden post genuinely
// disappears for every other viewer.
export const getFeed = async () => {
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
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

export const uploadPostVideo = async (userId: string, file: File | Blob, ext: string = 'webm') => {
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('post-videos').upload(path, file, { contentType: file.type || 'video/webm' })
  return { path: error ? null : path, error }
}

export const createPost = async (
  organisationId: string, authorId: string,
  fields: { content?: string; image_path?: string; video_path?: string; visibility?: 'organisation' | 'public'; sticker_choices?: string[]; milestone_type?: string | null }
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

// ── Wins strip (Feed v2.0) -- ephemeral, achievement-only, expires
// like a story. Same org-or-public visibility model as posts, but
// scoped to roughly the last two days client-side rather than a
// stored expiry -- nothing here is meant to accumulate into a
// permanent highlight reel. ──
export const createWin = async (
  authorId: string, organisationId: string,
  fields: { milestone_type: string; content?: string; image_path?: string; video_path?: string; visibility?: 'organisation' | 'public' }
) => {
  const { data, error } = await supabase
    .from('wins')
    .insert([{ author_id: authorId, organisation_id: organisationId, visibility: 'organisation', ...fields }])
    .select()
    .single()
  return { data, error }
}

// The green tick beside a post author's name -- "verified" means this
// person has at least one live (non-revoked) piece of verified work,
// not that this specific post is a verification milestone. Batch-
// checked once per Feed load across every distinct author showing.
export const getVerifiedAuthorIds = async (authorIds: string[]) => {
  if (authorIds.length === 0) return { data: [] as string[], error: null }
  const { data, error } = await supabase
    .from('verifications')
    .select('submissions!inner(student_id)')
    .is('revoked_at', null)
    .in('submissions.student_id', authorIds)
  if (error || !data) return { data: [], error }
  return { data: Array.from(new Set((data as any[]).map(v => v.submissions?.student_id).filter(Boolean))), error: null }
}

export const reportWin = async (winId: string, organisationId: string | null, reporterId: string, reasonKey: string, note: string) => {
  const reasonLabel = REPORT_REASONS.find(r => r.key === reasonKey)?.label || 'Something else'
  const reason = note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel
  return submitReport(reporterId, organisationId, 'win', reason, winId)
}

// "Everyone can see it, don't limit it" -- no org-scoping here any
// more, same call as getFeed. RLS ("wins: read") already narrows a
// hidden row to just its own author/org-staff, so this stays safe
// without a client-side filter doing that job.
export const getWins = async () => {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('wins')
    .select('*, author:users!wins_author_id_fkey(full_name)')
    .eq('hidden', false)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
  return { data, error }
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

// Fire-and-forget, once per post per page-load (deduped client-side) —
// a real counter, not a fabricated one, just a simple v1 of "shown in
// your feed" rather than "watched to completion."
export const incrementPostViews = async (postId: string) => {
  const { error } = await supabase.rpc('increment_post_views', { p_post_id: postId })
  return { error }
}

// Same "shown once per page-load" counter, for a verified work card on
// Discover's Explore tab -- the request was "add how many views on
// discover as well", i.e. the same real view count Feed already
// tracks, just for verifications instead of posts.
export const incrementVerificationViews = async (verificationId: string) => {
  const { error } = await supabase.rpc('increment_verification_views', { p_verification_id: verificationId })
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
export const updateOrganisationProfile = async (organisationId: string, updates: { name?: string; safeguarding_lead_id?: string; logo_path?: string | null }) => {
  const { error } = await supabase.from('organisations').update(updates).eq('id', organisationId)
  return { error }
}

// Org logo -- "a profile picture so it appears proper when they post
// a course/brief/workshop". Reuses the avatars bucket (public read,
// owner-folder write, same as uploadOpportunityLogo already does for
// an employer's own job postings) rather than needing a new storage
// policy: the path is keyed to the UPLOADING STAFF MEMBER's own uid
// (they own that file object under existing "avatars: owner *"
// policies), the resulting path is then just stored on the
// organisation row itself -- ownership of the storage object and
// ownership of the org are two different things, and only the second
// one is what actually gates who can change organisations.logo_path
// (RLS: "organisations: staff update own org").
export const uploadOrgLogo = async (staffUserId: string, file: File) => {
  const path = `${staffUserId}/org-logo-${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('avatars').upload(path, file)
  return { path: error ? null : path, error }
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

// A student's own org name + who their safeguarding contact is --
// read-only here on purpose (a student cannot move themselves to
// another school, and the signpost in Safety needs a real name to
// point at rather than a generic line).
export const getMyOrganisationInfo = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('name, safeguarding_lead:users!organisations_safeguarding_lead_fk(full_name, email)')
    .eq('id', organisationId)
    .single()
  return { data, error }
}

// Case-insensitively unique (see the migration's index) -- checked
// before saving so a taken handle fails with a clear message instead
// of a raw constraint-violation error.
export const isUsernameAvailable = async (username: string, excludeUserId: string) => {
  const { data, error } = await supabase
    .from('users').select('id').ilike('username', username).neq('id', excludeUserId).maybeSingle()
  if (error) return { available: false, error }
  return { available: !data, error: null }
}

// ── Settings: profile photo, privacy, security, blocking ──────────
// avatars is a public bucket -- reading it back is just the public
// URL, no signed-URL round trip needed the way private buckets need.
export const uploadAvatar = async (userId: string, file: File) => {
  const path = `${userId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('avatars').upload(path, file)
  if (error) return { path: null, error }
  await supabase.from('users').update({ avatar_path: path }).eq('id', userId)
  return { path, error: null }
}
export const removeAvatar = async (userId: string, currentPath?: string | null) => {
  const { error } = await supabase.from('users').update({ avatar_path: null }).eq('id', userId)
  if (!error && currentPath) await supabase.storage.from('avatars').remove([currentPath])
  return { error }
}
export const getAvatarUrl = (path?: string | null) =>
  path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null

// Changing email through Supabase auth sends a confirmation link to
// the NEW address and only swaps it over once that's clicked --
// exactly "changing it requires verifying the new address", not an
// immediate overwrite.
export const requestEmailChange = async (newEmail: string) => {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  return { error }
}

export const sendPasswordResetEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
  })
  return { error }
}

// scope: 'global' signs out every session on every device, not just
// this one -- "sign out of all of them".
export const signOutEverywhere = async () => {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  return { error }
}

export const getBlockedUsers = async (blockerId: string) => {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('id, blocked_id, created_at, blocked:users!blocked_users_blocked_id_fkey(full_name)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false })
  return { data, error }
}
export const blockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase.from('blocked_users').insert([{ blocker_id: blockerId, blocked_id: blockedId }])
  return { error }
}
export const unblockUser = async (rowId: string) => {
  const { error } = await supabase.from('blocked_users').delete().eq('id', rowId)
  return { error }
}

// Under-18 "delete my account" is deliberately not a bare self-serve
// action -- it's raised as a report routed to the student's own
// organisation, the same queue safeguarding staff already work from
// (getOrgReports/resolveReport), so a responsible adult sees it and
// helps rather than a child silently erasing everything alone.
export const requestMinorAccountDeletion = async (userId: string, organisationId: string) => {
  const { error } = await submitReport(userId, organisationId, 'user', 'ACCOUNT DELETION REQUESTED (under 18) — please route through your safeguarding process.', userId)
  return { error }
}

export const setCookieConsent = async (userId: string, analytics: boolean) => {
  const { error } = await supabase.from('users').update({
    cookie_consent: { essential: true, analytics, consented_at: new Date().toISOString() },
  }).eq('id', userId)
  return { error }
}

// ── Reporting ───────────────────────────────────────────────────
export const submitReport = async (
  reporterId: string, organisationId: string | null,
  targetType: 'post' | 'user' | 'submission' | 'general' | 'win', reason: string, targetId?: string
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

// ── Feed post reporting: report -> instant, neutral auto-hide ->
// human review (restore or remove). The moment-of-report and human-
// decision plumbing already lives in the database as triggers on
// `reports`, not written here on purpose -- they're the actual source
// of truth so the behaviour can't drift from what the client thinks
// happened:
//   - auto_hide_reported_post: any report with target_type='post'
//     immediately sets that post's hidden=true. Instant, before any
//     human has looked at it -- exactly "auto-hide protects first."
//   - notify_report: notifies every institution_staff/provider_staff
//     in the report's organisation (the safeguarding lead is one of
//     them) the moment a report is filed, not only once it's resolved.
//   - resolve_report_unhide: flips a post back to hidden=false only
//     when its report's status moves pending -> 'dismissed' -- which
//     is why Restore below writes exactly that status, and Remove
//     deliberately writes a different one ('actioned') that no trigger
//     un-hides on, so the post stays down.
export const REPORT_REASONS = [
  { key: 'bullying', label: 'It is bullying or unkind' },
  { key: 'inappropriate', label: 'It is inappropriate or upsetting' },
  { key: 'not_real', label: 'It is not real, or not their work' },
  { key: 'other', label: 'Something else' },
] as const

export const reportPost = async (postId: string, organisationId: string | null, reporterId: string, reasonKey: string, note: string) => {
  const reasonLabel = REPORT_REASONS.find(r => r.key === reasonKey)?.label || 'Something else'
  const reason = note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel
  return submitReport(reporterId, organisationId, 'post', reason, postId)
}

// Reported posts still awaiting a human decision, for this
// organisation's staff -- grouped by post (not one row per report) so
// a post several people reported shows once, with its full count.
// target_id has no FK (reports is polymorphic across post/user/
// submission/general), so this is two queries merged client-side
// rather than one embedded join.
export const getReportedPosts = async (organisationId: string) => {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*, users!reports_reporter_id_fkey(full_name)')
    .eq('organisation_id', organisationId)
    .eq('target_type', 'post')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error || !reports || reports.length === 0) return { data: [], error }

  const postIds = Array.from(new Set(reports.map(r => r.target_id).filter(Boolean)))
  const { data: posts } = await supabase.from('posts_feed').select('*').in('id', postIds as string[])

  const grouped = postIds
    .map(id => ({ post: posts?.find(p => p.id === id), reports: reports.filter(r => r.target_id === id) }))
    .filter((g): g is { post: any; reports: any[] } => !!g.post)
    .sort((a, b) => new Date(b.reports[0].created_at).getTime() - new Date(a.reports[0].created_at).getTime())

  return { data: grouped, error: null }
}

// Restore: the post returns to the feed as if nothing happened.
export const restorePost = async (postId: string, reviewerId: string) => {
  const { error } = await supabase
    .from('reports')
    .update({ status: 'dismissed', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('target_type', 'post').eq('target_id', postId).eq('status', 'pending')
  return { error }
}

// Remove: the post stays down. Repeated/serious breaches reaching this
// point is exactly what "escalated to the safeguarding lead" means in
// practice here -- every staff member (lead included) was already
// notified the moment it was first reported, per notify_report above.
export const removePost = async (postId: string, reviewerId: string) => {
  const { error } = await supabase
    .from('reports')
    .update({ status: 'actioned', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('target_type', 'post').eq('target_id', postId).eq('status', 'pending')
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

export const setPresenceStatus = async (userId: string, status: 'active' | 'busy' | 'away' | 'offline' | 'do_not_disturb') => {
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
      id, verified_at, submission_id, views_count,
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

export const expressInterest = async (
  employerId: string, studentId: string,
  fields?: { message?: string; opportunity_label?: string },
) => {
  const { data, error } = await supabase
    .from('interest')
    .insert([{ employer_id: employerId, student_id: studentId, ...fields }])
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

export const createOpportunity = async (employerId: string, fields: {
  title: string; description?: string; type?: 'job' | 'apprenticeship' | 'internship'
  salary?: string; requirements?: string; location?: string; logo_path?: string
}) => {
  const { data, error } = await supabase
    .from('opportunities')
    .insert([{ employer_id: employerId, ...fields }])
    .select()
    .single()
  return { data, error }
}

// Reuses the avatars bucket's own storage (public read, owner-folder
// write) -- same RLS shape it already has, no new bucket needed.
export const uploadOpportunityLogo = async (employerId: string, file: File) => {
  const path = `${employerId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('avatars').upload(path, file)
  return { path: error ? null : path, error }
}

export const deleteOpportunity = async (id: string) => {
  const { error } = await supabase.from('opportunities').delete().eq('id', id)
  return { error }
}

// Student-facing browse (all employers' postings — the table is
// public-read by design already).
export const getAllOpportunities = async () => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

// Discover's Jobs/Apprenticeships/Internships tabs — same table,
// filtered by type.
export const getOpportunities = async (type?: 'job' | 'apprenticeship' | 'internship') => {
  let query = supabase
    .from('opportunities')
    .select('*, employer:users!opportunities_employer_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (type) query = query.eq('type', type)
  const { data, error } = await query
  return { data, error }
}

// "Apply" on a Jobs/Apprenticeships/Internships card — the reverse
// direction from expressInterest: a student applying to a posting,
// not an employer expressing interest in a student. Same org-routing
// shape either way, RLS decides who reads it next.
export const applyToOpportunity = async (opportunityId: string, studentId: string) => {
  const { data, error } = await supabase
    .from('opportunity_interest')
    .insert([{ opportunity_id: opportunityId, student_id: studentId }])
    .select()
    .single()
  // Feeds the job tracker (Complete Build Spec v1.0, Part 2) --
  // "Applied" is the pipeline's literal first stage. Best-effort: a
  // failure here shouldn't undo the application itself, which already
  // succeeded above.
  if (data) createApplicationFromOpportunity(data.id, opportunityId, studentId).catch(() => {})
  return { data, error }
}

export const getMyOpportunityApplications = async (studentId: string) => {
  const { data, error } = await supabase
    .from('opportunity_interest')
    .select('*')
    .eq('student_id', studentId)
  return { data, error }
}

// 18+ only (enforced by RLS, not this function) — the student-facing
// end of the employer "express interest" flow. Under-18s have no read
// path to this table at all; their organisation sees it instead.
export const getMyReceivedInterest = async (studentId: string) => {
  const { data, error } = await supabase
    .from('interest')
    .select('*, employer:users!interest_employer_id_fkey(full_name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Shared by both an 18+ student acting on their own interest and org
// staff acting on behalf of an under-18 student -- RLS decides which
// of those two the caller actually is, this is just the one update.
export const respondToInterest = async (interestId: string, status: 'accepted' | 'declined') => {
  const { data, error } = await supabase
    .from('interest')
    .update({ status })
    .eq('id', interestId)
    .select()
    .single()
  // "Accepted requests can feed a young person into the job tracker"
  // (Complete Build Spec v1.0, Part 2) -- only on acceptance, never on
  // decline. Best-effort, same reasoning as applyToOpportunity above.
  if (data && status === 'accepted') createApplicationFromAcceptedInterest(interestId, data.employer_id, data.student_id).catch(() => {})
  return { data, error }
}

// Org staff: every interest row raised against their org's students —
// RLS already narrows this to their own org, this is the same shape
// for institution and provider staff alike.
export const getOrgInterest = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('interest')
    .select('*, employer:users!interest_employer_id_fkey(full_name), student:users!interest_student_id_fkey(id, full_name, date_of_birth)')
    .order('created_at', { ascending: false })
  return { data, error }
}

// ── Interest received: the controlled thread ──────────────────────
// The young person is never a party -- no student read path exists on
// interest_messages at all (see the migration's RLS). Only the
// employer and the student's own org staff can ever read or write here.
export const getInterestMessages = async (interestId: string) => {
  const { data, error } = await supabase
    .from('interest_messages')
    .select('*')
    .eq('interest_id', interestId)
    .order('created_at', { ascending: true })
  return { data, error }
}

export const sendInterestMessage = async (
  interestId: string, senderId: string, senderRole: 'employer' | 'org', body: string,
) => {
  const { data, error } = await supabase
    .from('interest_messages')
    .insert([{ interest_id: interestId, sender_id: senderId, sender_role: senderRole, body }])
    .select()
    .single()
  return { data, error }
}

// Org can close the thread at any time, independent of accept/decline
// -- "closed" just means no further exchange, not a verdict.
export const closeInterestThread = async (interestId: string) => {
  const { data, error } = await supabase
    .from('interest')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', interestId)
    .select()
    .single()
  return { data, error }
}

// ── Job tracker (Complete Build Spec v1.0, Part 2) + Employer side
// Candidates (Part 3) -- the same board, viewed from the organisation
// (watches only) or the employer (moves cards) side. `applications` is
// its own table on purpose, kept separate from `interest` and
// `opportunity_interest` so neither of those already-shipped,
// safeguarding-sensitive flows is touched -- an application is CREATED
// by hooking the exact moments the spec names as the pipeline's start,
// not by repurposing their own status columns. ────────────────────

export type ApplicationStage = 'applied' | 'reviewing' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'not_progressing'
export const APPLICATION_STAGES: ApplicationStage[] = ['applied', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'not_progressing']

const logApplicationActivity = async (applicationId: string, actorId: string | null, action: string, detail?: string) => {
  await supabase.from('application_activity').insert([{ application_id: applicationId, actor_id: actorId, action, detail }])
}

// A student applying to a posted opportunity -- "Applied" is the
// literal first pipeline stage, so this is the entry point for that path.
export const createApplicationFromOpportunity = async (opportunityInterestId: string, opportunityId: string, studentId: string) => {
  const [{ data: opp }, { data: student }] = await Promise.all([
    supabase.from('opportunities').select('employer_id').eq('id', opportunityId).single(),
    supabase.from('users').select('organisation_id').eq('id', studentId).single(),
  ])
  if (!opp) return { data: null, error: { message: 'Opportunity not found.' } as any }
  const { data, error } = await supabase
    .from('applications')
    .insert([{
      student_id: studentId, employer_id: opp.employer_id, opportunity_id: opportunityId,
      organisation_id: student?.organisation_id || null, source_opportunity_interest_id: opportunityInterestId, stage: 'applied',
    }])
    .select().single()
  if (data) await logApplicationActivity(data.id, studentId, 'applied')
  return { data, error }
}

// An employer's direct interest in a student being ACCEPTED -- "Accepted
// requests can feed a young person into the job tracker."
export const createApplicationFromAcceptedInterest = async (interestId: string, employerId: string, studentId: string) => {
  const { data: student } = await supabase.from('users').select('organisation_id').eq('id', studentId).single()
  const { data, error } = await supabase
    .from('applications')
    .insert([{ student_id: studentId, employer_id: employerId, organisation_id: student?.organisation_id || null, source_interest_id: interestId, stage: 'applied' }])
    .select().single()
  if (data) await logApplicationActivity(data.id, employerId, 'applied')
  return { data, error }
}

export const getApplicationsForEmployer = async (employerId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, student:users!applications_student_id_fkey(id, full_name, date_of_birth), opportunity:opportunities(title)')
    .eq('employer_id', employerId)
    .order('stage_updated_at', { ascending: false })
  return { data, error }
}

export const getApplicationsForOrganisation = async (organisationId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, student:users!applications_student_id_fkey(id, full_name, date_of_birth), employer:users!applications_employer_id_fkey(full_name), opportunity:opportunities(title)')
    .eq('organisation_id', organisationId)
    .order('stage_updated_at', { ascending: false })
  return { data, error }
}

// Discover's "Job tracking" (18+ only in the UI -- see the RLS policy
// note on this table for why the read itself isn't age-gated).
export const getMyApplications = async (studentId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, employer:users!applications_employer_id_fkey(full_name), opportunity:opportunities(title)')
    .eq('student_id', studentId)
    .order('stage_updated_at', { ascending: false })
  return { data, error }
}

const STAGE_LABEL: Record<ApplicationStage, string> = {
  applied: 'Applied', reviewing: 'Reviewing', shortlisted: 'Shortlisted', interview: 'Interview',
  offer: 'Offer', hired: 'Hired', not_progressing: 'Not progressing',
}

// Only the employer moves cards ("The EMPLOYER moves cards between
// stages; they own stage changes... The ORGANISATION does not move
// cards"), enforced by RLS (applications: employer manage own is the
// only UPDATE-of-stage-shaped policy an employer's own auth.uid() can hit).
export const moveApplicationStage = async (applicationId: string, stage: ApplicationStage, actorId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .update({ stage, stage_updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select().single()
  if (data) await logApplicationActivity(applicationId, actorId, `moved_to_${stage}`, `Moved to ${STAGE_LABEL[stage]}`)
  return { data, error }
}

export const setApplicationPrivateNote = async (applicationId: string, note: string) => {
  const { error } = await supabase.from('applications').update({ private_note: note }).eq('id', applicationId)
  return { error }
}

export const getApplicationActivity = async (applicationId: string) => {
  const { data, error } = await supabase
    .from('application_activity')
    .select('*, actor:users(full_name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// ── Employer side (Part 3): Talent pools ───────────────────────────
export const getTalentPools = async (employerId: string) => {
  const { data, error } = await supabase
    .from('talent_pools')
    .select('*, talent_pool_members(count)')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createTalentPool = async (employerId: string, name: string) => {
  const { data, error } = await supabase.from('talent_pools').insert([{ employer_id: employerId, name }]).select().single()
  return { data, error }
}

export const deleteTalentPool = async (id: string) => {
  const { error } = await supabase.from('talent_pools').delete().eq('id', id)
  return { error }
}

export const getTalentPoolMembers = async (poolId: string) => {
  const { data, error } = await supabase
    .from('talent_pool_members')
    .select('id, created_at, student:users(id, full_name)')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const addToTalentPool = async (poolId: string, studentId: string) => {
  const { error } = await supabase.from('talent_pool_members').insert([{ pool_id: poolId, student_id: studentId }])
  return { error }
}

export const removeFromTalentPool = async (memberRowId: string) => {
  const { error } = await supabase.from('talent_pool_members').delete().eq('id', memberRowId)
  return { error }
}

// ── Employer side (Part 3): Partners -- derived, not a separate
// relationship table. A "partner" is any organisation that has
// actually shown up through real interaction (an application), so
// there's nothing to fake-connect -- reached/hired counts come
// straight from applications grouped by organisation.
export const getEmployerPartners = async (employerId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('organisation_id, stage, organisation:organisations(id, name, type)')
    .eq('employer_id', employerId)
    .not('organisation_id', 'is', null)
  if (error || !data) return { data: null, error }
  const byOrg = new Map<string, { id: string; name: string; type: string; reached: number; hired: number }>()
  for (const row of data as any[]) {
    const org = row.organisation
    if (!org) continue
    if (!byOrg.has(org.id)) byOrg.set(org.id, { id: org.id, name: org.name, type: org.type, reached: 0, hired: 0 })
    const entry = byOrg.get(org.id)!
    entry.reached++
    if (row.stage === 'hired') entry.hired++
  }
  return { data: Array.from(byOrg.values()).sort((a, b) => b.reached - a.reached), error: null }
}

// ── Employer side (Part 3): Inbox ──────────────────────────────────
// "A list of activity items: new applications, organisation responses
// to interest requests, and status updates." No unread-dot here --
// there's no real read-tracking behind it yet, and a fake blue dot
// that never actually reflects anything read/unread would be worse
// than not having one.
export const getEmployerInboxItems = async (employerId: string) => {
  const [{ data: apps }, { data: interest }] = await Promise.all([
    supabase.from('applications').select('id, stage, created_at, student:users!applications_student_id_fkey(full_name), opportunity:opportunities(title)').eq('employer_id', employerId),
    supabase.from('interest').select('id, status, created_at, student:users!interest_student_id_fkey(full_name)').eq('employer_id', employerId),
  ])
  const items: { id: string; icon: 'application' | 'interest'; variant: 'application' | 'accepted' | 'declined'; name: string; text: string; created_at: string }[] = []
  for (const a of apps || []) {
    const name = (a as any).student?.full_name || 'A student'
    items.push({ id: `app-${a.id}`, icon: 'application', variant: 'application', name, text: `${name} applied to ${(a as any).opportunity?.title || 'a role'}`, created_at: a.created_at })
  }
  for (const i of interest || []) {
    const name = (i as any).student?.full_name || 'A student'
    if (i.status === 'accepted') items.push({ id: `int-${i.id}`, icon: 'interest', variant: 'accepted', name, text: `${name}'s organisation accepted your request`, created_at: i.created_at })
    else if (i.status === 'declined') items.push({ id: `int-${i.id}`, icon: 'interest', variant: 'declined', name, text: `${name}'s organisation declined your request`, created_at: i.created_at })
  }
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return { data: items, error: null }
}

// ── Employer side (Part 3): Dashboard ──────────────────────────────
export const getEmployerDashboardStats = async (employerId: string) => {
  const { data, error } = await supabase
    .from('applications')
    .select('stage, student_id, created_at, organisation:organisations(name)')
    .eq('employer_id', employerId)
  if (error || !data) return { data: null, error }
  const rows = data as any[]
  const hired = rows.filter(r => r.stage === 'hired').length
  const inPipeline = rows.filter(r => !['hired', 'not_progressing'].includes(r.stage)).length
  const youngPeopleReached = new Set(rows.map(r => r.student_id)).size
  const byStage: Record<ApplicationStage, number> = { applied: 0, reviewing: 0, shortlisted: 0, interview: 0, offer: 0, hired: 0, not_progressing: 0 }
  for (const r of rows) if (r.stage in byStage) byStage[r.stage as ApplicationStage]++
  const hiresByPartner = new Map<string, number>()
  for (const r of rows) {
    if (r.stage === 'hired' && r.organisation?.name) hiresByPartner.set(r.organisation.name, (hiresByPartner.get(r.organisation.name) || 0) + 1)
  }

  // Real activity trend, last 6 months -- how many applications actually
  // landed each month, so "up or down" is a fact, not a guess.
  const now = new Date()
  const months: { key: string; label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-GB', { month: 'short' }), count: 0 })
  }
  for (const r of rows) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const m = months.find(m => m.key === key)
    if (m) m.count++
  }
  const thisMonth = months[months.length - 1].count
  const lastMonth = months[months.length - 2].count
  const trend: 'up' | 'down' | 'flat' = thisMonth > lastMonth ? 'up' : thisMonth < lastMonth ? 'down' : 'flat'

  return {
    data: {
      hired, inPipeline, youngPeopleReached, byStage,
      hiresByPartner: Array.from(hiresByPartner.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      monthlyActivity: months, trend,
    },
    error: null,
  }
}

// Never exposes raw date_of_birth to an employer -- just the computed
// boolean, same pattern as posts_feed's author_anonymised.
export const getStudentsAdultStatus = async (studentIds: string[]): Promise<Record<string, boolean>> => {
  if (studentIds.length === 0) return {}
  const { data } = await supabase.rpc('students_adult_status', { p_student_ids: studentIds })
  const map: Record<string, boolean> = {}
  for (const row of (data as any[]) || []) map[row.student_id] = row.is_adult
  return map
}

// ── Guest employer invite (Type 1 — org-invited, scoped to one
// student, no browsing beyond what's explicitly shared) ──────────

// Org staff: create an invite scoped to one OR MORE students, in one
// step. guest_invite_shares is a one-invite-to-many-students join
// table -- "the common case is one student; a role with several
// candidates can include a few, without creating separate links."
// employer_email is optional metadata (who to send the link to) --
// it does not itself send anything, the org still copies/shares the
// link today.
export const createGuestInvite = async (organisationId: string, createdBy: string, studentIds: string[], employerEmail?: string) => {
  const token = crypto.randomUUID()
  const { data: invite, error } = await supabase
    .from('guest_invites')
    .insert([{ organisation_id: organisationId, created_by: createdBy, token, employer_email: employerEmail?.trim() || null }])
    .select()
    .single()
  if (error || !invite) return { data: null, error }
  const { error: shareError } = await supabase
    .from('guest_invite_shares')
    .insert(studentIds.map(studentId => ({ invite_id: (invite as any).id, student_id: studentId })))
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

// ── Demo gateway (public "try LERN" login — see app/api/demo-switch) ──
// One real email+password (Lern12@gmail.com / Lerntesterapp) anyone can
// sign in with; this then swaps the session into whichever of the 4
// seeded test accounts the visitor picks. Only works while the current
// session belongs to a user flagged is_demo_gateway — enforced server-side.
export const demoSwitchRole = async (role: Role) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { error: { message: 'Not signed in.' } }
  const res = await fetch('/api/demo-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ role }),
  })
  const body = await res.json()
  if (!res.ok) return { error: body }
  // token_hash-based verification takes ONLY { token_hash, type } -- passing
  // email alongside it (even though the API response includes it) mixes
  // it with the separate OTP-code shape ({ email, token, type }) and is
  // exactly what Supabase's "Only the token_hash and type should be
  // provided" error is guarding against.
  const { error } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: 'magiclink' })
  return { error }
}

// ── Profile ────────────────────────────────────────────────────
export const getFollowCounts = async (userId: string) => {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('followed_id', userId),
    supabase.from('followers').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers || 0, following: following || 0 }
}

export const amIFollowing = async (viewerId: string, profileId: string) => {
  const { data } = await supabase.from('followers').select('id').eq('follower_id', viewerId).eq('followed_id', profileId).maybeSingle()
  return !!data
}

export const followUser = async (followerId: string, followedId: string) => {
  const { error } = await supabase.from('followers').insert([{ follower_id: followerId, followed_id: followedId }])
  return { error }
}

export const unfollowUser = async (followerId: string, followedId: string) => {
  const { error } = await supabase.from('followers').delete().eq('follower_id', followerId).eq('followed_id', followedId)
  return { error }
}

// The trusted core of a profile — every non-revoked verification for
// this student, most recent first.
export const getVerifiedWorkForProfile = async (studentId: string) => {
  const { data, error } = await supabase
    .from('verifications')
    .select(`
      id, verified_at, visibility,
      verifier:users!verifications_verified_by_fkey(full_name),
      submissions!inner(student_id, content, file_path, file_type, work_items(title, type, criteria, organisation_id, organisations(name)))
    `)
    .eq('submissions.student_id', studentId)
    .is('revoked_at', null)
    .order('verified_at', { ascending: false })
  return { data, error }
}

// ── Profile v2 (LERN Complete Build Spec: Student Profile, Job
// Tracker, Employer Side v1.0) ──────────────────────────────────────
export const updateProfileBioTags = async (userId: string, bio: string, interestTags: string[]) => {
  const { data, error } = await supabase
    .from('users')
    .update({ bio, interest_tags: interestTags.slice(0, 3) })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// "Experience" -- a student's own real-world entries (work placements,
// volunteering), distinct from both verified work (tutor green tick)
// and self-added qualifications (a certificate claim).
export const getExperienceEntries = async (studentId: string) => {
  const { data, error } = await supabase
    .from('experience_entries')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return { data, error }
}
export const addExperienceEntry = async (studentId: string, fields: { title: string; organisation?: string; description?: string }) => {
  const { data, error } = await supabase
    .from('experience_entries')
    .insert([{ student_id: studentId, ...fields }])
    .select()
    .single()
  return { data, error }
}
export const deleteExperienceEntry = async (id: string) => {
  const { error } = await supabase.from('experience_entries').delete().eq('id', id)
  return { error }
}

// Saved jobs -- private, own-view only. RLS already restricts read/
// write to the owner; there's no "public" variant of this query.
export const getSavedOpportunities = async (studentId: string) => {
  const { data, error } = await supabase
    .from('saved_opportunities')
    .select('*, opportunity:opportunities(*, employer:users!opportunities_employer_id_fkey(full_name))')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return { data, error }
}
export const saveOpportunity = async (studentId: string, opportunityId: string) => {
  const { data, error } = await supabase
    .from('saved_opportunities')
    .insert([{ student_id: studentId, opportunity_id: opportunityId }])
    .select()
    .single()
  return { data, error }
}
export const unsaveOpportunity = async (studentId: string, opportunityId: string) => {
  const { error } = await supabase.from('saved_opportunities').delete().eq('student_id', studentId).eq('opportunity_id', opportunityId)
  return { error }
}

export const getMyPosts = async (studentId: string) => {
  const { data, error } = await supabase
    .from('posts_feed')
    .select('*')
    .eq('author_id', studentId)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Self-declared, never verified — kept in a table that's never joined
// with verifications anywhere, so the two can't be blended by accident.
export const getSelfQualifications = async (studentId: string) => {
  const { data, error } = await supabase
    .from('self_qualifications')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const addSelfQualification = async (studentId: string, fields: { title: string; issuer?: string; file_path?: string }) => {
  const { data, error } = await supabase
    .from('self_qualifications')
    .insert([{ student_id: studentId, ...fields }])
    .select()
    .single()
  return { data, error }
}

export const deleteSelfQualification = async (id: string) => {
  const { error } = await supabase.from('self_qualifications').delete().eq('id', id)
  return { error }
}

export const uploadSelfQualificationFile = async (studentId: string, file: File) => {
  const path = `${studentId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('self-qualifications').upload(path, file)
  return { path: error ? null : path, error }
}
