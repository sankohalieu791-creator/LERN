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
export const createUserProfile = async (userId: string, username: string, email: string) => {
  const { data, error } = await supabase
    .from('users')
    .upsert([{ id: userId, username, email, account_type: 'student' }], { onConflict: 'id' })
  return { data, error }
}

export const acceptTerms = async (userId: string) => {
  const { error } = await supabase
    .from('users')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', userId)
  return { error }
}

export const recordProfileView = async (profileId: string, viewerId: string) => {
  if (profileId === viewerId) return
  const { error } = await supabase
    .from('profile_views')
    .insert([{ profile_id: profileId, viewer_id: viewerId }])
  return { error }
}

// Role-segmented "Viewed by" — e.g. "6 employers, 2 mentors" — computed
// client-side from the raw view log since it's a small per-profile dataset.
export const getProfileViewBreakdown = async (profileId: string) => {
  // profile_views has two FKs into users (profile_id, viewer_id) — PostgREST
  // can't infer which one to embed, so the relationship must be named explicitly.
  const { data, error } = await supabase
    .from('profile_views')
    .select('viewer_id, users!profile_views_viewer_id_fkey(account_type, instructor_role)')
    .eq('profile_id', profileId)
  if (!data) return { data: null, error }

  const counts: Record<string, number> = {}
  for (const row of data as any[]) {
    const u = row.users
    if (!u) continue
    const key = u.account_type === 'instructor' && u.instructor_role ? u.instructor_role : u.account_type
    counts[key] = (counts[key] ?? 0) + 1
  }
  return { data: { total: data.length, counts }, error: null }
}

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

export const getUserByUsername = async (username: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()
  return { data, error }
}

// Videos
export const getVideos = async () => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((v: any) => v.user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified, title').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((v: any) => ({ ...v, users: map[v.user_id] ?? null })), error }
}

export const getVideoById = async (videoId: string) => {
  const { data, error } = await supabase
    .from('videos').select('*').eq('id', videoId).single()
  if (!data) return { data, error }
  const { data: userData } = await supabase
    .from('users').select('id, username, avatar_url, verified, title').eq('id', data.user_id).single()
  return { data: { ...data, users: userData ?? null }, error }
}

export const createVideo = async (userId: string, videoData: any) => {
  const { data, error } = await supabase
    .from('videos')
    .insert([{ user_id: userId, ...videoData }])
  return { data, error }
}

// The org a user belongs to (as member, or as the org's admin). Null if none.
export const getMyOrgId = async (userId?: string): Promise<string | null> => {
  if (!userId) return null
  const { data: membership } = await supabase
    .from('organisation_members').select('organisation_id').eq('user_id', userId).maybeSingle()
  if (membership?.organisation_id) return membership.organisation_id
  const { data: adminOrg } = await supabase
    .from('organisations').select('id').eq('admin_user_id', userId).maybeSingle()
  return adminOrg?.id ?? null
}

// Courses — EVERY non-deleted course is listed, including an organisation's private
// ones. Private courses are surfaced with a "Private" badge and are locked: you can
// see they exist, but you can only enrol once you've joined the org via its invite
// link. `is_locked` tells the UI which ones to gate.
export const getCourses = async (userId?: string) => {
  const orgId = await getMyOrgId(userId)

  const { data, error } = await supabase
    .from('courses')
    .select('*, course_sessions(*)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error || !data) return { data: [], error }

  const ids = [...new Set(data.map((c: any) => c.instructor_id || c.user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified, title').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))

  return {
    data: data.map((c: any) => ({
      ...c,
      users: map[c.instructor_id || c.user_id] ?? null,
      is_locked: c.visibility === 'private' && (!orgId || c.organisation_id !== orgId),
    })),
    error: null,
  }
}

export const getCourseById = async (courseId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .select('*, course_sessions(*)')
    .eq('id', courseId)
    .eq('is_deleted', false)
    .single()
  if (!data) return { data, error }
  const { data: userData } = await supabase
    .from('users').select('id, username, avatar_url, verified, title')
    .eq('id', data.instructor_id || data.user_id).single()
  return { data: { ...data, users: userData ?? null }, error }
}

export const createCourse = async (instructorId: string, courseData: any) => {
  const { data, error } = await supabase
    .from('courses')
    .insert([{ instructor_id: instructorId, user_id: instructorId, ...courseData }])
    .select()
  return { data, error }
}

export const enrollCourse = async (courseId: string, userId: string) => {
  // A private (organisation) course can only be joined by members of that org —
  // i.e. someone who used the institution's invite link. Anyone can SEE the course
  // in the list, but enrolling requires membership.
  const { data: course } = await supabase
    .from('courses').select('visibility, organisation_id').eq('id', courseId).maybeSingle()

  if (course?.visibility === 'private') {
    const orgId = await getMyOrgId(userId)
    if (!orgId || orgId !== course.organisation_id) {
      return {
        data: null,
        error: { message: 'This is a private course. Join the institution with its invite link to enrol.' } as any,
      }
    }
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert([{ course_id: courseId, user_id: userId }])
  return { data, error }
}

export const isEnrolled = async (courseId: string, userId: string) => {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .single()
  return { data, error }
}

// Workshops
export const createWorkshop = async (instructorId: string, workshopData: any) => {
  const { data, error } = await supabase
    .from('workshops')
    .insert([{ instructor_id: instructorId, user_id: instructorId, ...workshopData }])
    .select()
  return { data, error }
}

export const getWorkshops = async () => {
  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .order('workshop_date', { ascending: true })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((w: any) => w.instructor_id || w.user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((w: any) => ({ ...w, users: map[w.instructor_id || w.user_id] ?? null })), error }
}

// Likes
export const likeVideo = async (videoId: string, userId: string) => {
  const { data, error } = await supabase
    .from('video_likes')
    .insert([{ video_id: videoId, user_id: userId }])
  return { data, error }
}

export const unlikeVideo = async (videoId: string, userId: string) => {
  const { error } = await supabase
    .from('video_likes')
    .delete()
    .eq('video_id', videoId)
    .eq('user_id', userId)
  return { error }
}

export const hasUserLiked = async (videoId: string, userId: string) => {
  const { data, error } = await supabase
    .from('video_likes')
    .select('*')
    .eq('video_id', videoId)
    .eq('user_id', userId)
    .single()
  return { data: !!data, error }
}

// Follow
async function syncFollowCounts(followerId: string, followingId: string) {
  const [{ count: fwing }, { count: fwers }] = await Promise.all([
    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', followerId),
    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', followingId),
  ])
  await Promise.all([
    supabase.from('users').update({ following_count: fwing ?? 0 }).eq('id', followerId),
    supabase.from('users').update({ followers_count: fwers ?? 0 }).eq('id', followingId),
  ])
}

export const followUser = async (followerId: string, followingId: string) => {
  const { data, error } = await supabase
    .from('followers')
    .upsert([{ follower_id: followerId, following_id: followingId }], { onConflict: 'follower_id,following_id', ignoreDuplicates: true })
  if (!error) syncFollowCounts(followerId, followingId).catch(() => {})
  return { data, error }
}

export const unfollowUser = async (followerId: string, followingId: string) => {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (!error) syncFollowCounts(followerId, followingId).catch(() => {})
  return { error }
}

export const isFollowing = async (followerId: string, followingId: string) => {
  const { data, error } = await supabase
    .from('followers')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single()
  return { data: !!data, error }
}

// Bulk versions — single DB round-trip instead of N individual calls
export const getLikedVideoIds = async (userId: string, videoIds: string[]): Promise<string[]> => {
  if (!videoIds.length) return []
  const { data } = await supabase
    .from('video_likes')
    .select('video_id')
    .eq('user_id', userId)
    .in('video_id', videoIds)
  return (data || []).map((r: any) => r.video_id as string)
}

export const getFollowingUserIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId)
  return (data || []).map((r: any) => r.following_id as string)
}

export const getFollowersList = async (userId: string) => {
  const { data, error } = await supabase
    .from('followers')
    .select('follower_id')
    .eq('following_id', userId)
  if (!data || error) return { data: [], error }
  const ids = data.map((r: any) => r.follower_id).filter(Boolean)
  if (!ids.length) return { data: [], error: null }
  const { data: users } = await supabase
    .from('users')
    .select('id, username, avatar_url, verified, title')
    .in('id', ids)
  return { data: users ?? [], error: null }
}

export const getFollowingList = async (userId: string) => {
  const { data, error } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId)
  if (!data || error) return { data: [], error }
  const ids = data.map((r: any) => r.following_id).filter(Boolean)
  if (!ids.length) return { data: [], error: null }
  const { data: users } = await supabase
    .from('users')
    .select('id, username, avatar_url, verified, title')
    .in('id', ids)
  return { data: users ?? [], error: null }
}

// Comments
export const addComment = async (videoId: string, userId: string, text: string) => {
  const { data, error } = await supabase
    .from('comments')
    .insert([{ video_id: videoId, user_id: userId, text }])
  return { data, error }
}

export const getComments = async (videoId: string) => {
  const { data, error } = await supabase
    .from('comments').select('*').eq('video_id', videoId).order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((c: any) => c.user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((c: any) => ({ ...c, users: map[c.user_id] ?? null })), error }
}

// Projects
export const createProject = async (userId: string, projectData: any) => {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ user_id: userId, ...projectData }])
  return { data, error }
}

export const getProjectsByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

export const updateProject = async (projectId: string, updates: any) => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
  return { data, error }
}

// Certificates
export const addCertificate = async (userId: string, certData: any) => {
  const { data, error } = await supabase
    .from('certificates')
    .insert([{ user_id: userId, ...certData }])
  return { data, error }
}

export const getCertificatesByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

// Delete content
export const deleteVideo = async (videoId: string) => {
  const { error } = await supabase.from('videos').delete().eq('id', videoId)
  return { error }
}

export const deleteProject = async (projectId: string) => {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  return { error }
}

export const deleteCertificate = async (certId: string) => {
  const { error } = await supabase.from('certificates').delete().eq('id', certId)
  return { error }
}

// Notifications
export const getNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

export const createNotification = async (
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
  sender?: { id?: string; username?: string; avatar_url?: string | null }
) => {
  await supabase.from('notifications').insert([{
    user_id: userId,
    type,
    title,
    body,
    link,
    sender_id:         sender?.id ?? null,
    sender_username:   sender?.username ?? null,
    sender_avatar_url: sender?.avatar_url ?? null,
  }])
}

export const markNotificationsRead = async (userId: string) => {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

export const notifyFollowers = async (
  instructorId: string,
  type: string,
  title: string,
  body: string,
  link: string,
  sender: { id: string; username: string; avatar_url: string | null }
) => {
  const { data } = await supabase
    .from('followers')
    .select('follower_id')
    .eq('following_id', instructorId)
  const ids = ((data || []) as any[]).map((r: any) => r.follower_id).filter(Boolean)
  if (!ids.length) return
  await supabase.from('notifications').insert(
    ids.map((followerId: string) => ({
      user_id: followerId,
      type,
      title,
      body,
      link,
      sender_id: sender.id,
      sender_username: sender.username,
      sender_avatar_url: sender.avatar_url,
    }))
  )
  // Push notification to followers who are outside the app
  if (typeof window !== 'undefined') {
    import('@/lib/push').then(({ sendPushToMany }) => {
      sendPushToMany(ids, title, body, link)
    })
  }
}

// Training requests
export const sendTrainingRequest = async (
  fromUserId: string,
  toInstructorId: string,
  type: 'training' | 'mentorship',
  message: string
) => {
  const { data, error } = await supabase
    .from('training_requests')
    .insert([{ from_user_id: fromUserId, to_instructor_id: toInstructorId, type, message, status: 'pending' }])
  return { data, error }
}

export const getInstructorRequests = async (instructorId: string) => {
  const { data, error } = await supabase
    .from('training_requests')
    .select('*')
    .eq('to_instructor_id', instructorId)
    .order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set([
    ...data.map((r: any) => r.from_user_id),
    ...data.map((r: any) => r.about_user_id),
  ].filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return {
    data: data.map((r: any) => ({
      ...r,
      requester: map[r.from_user_id] ?? null,
      about: r.about_user_id ? (map[r.about_user_id] ?? null) : null,
    })),
    error,
  }
}

export const updateRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
  const { data, error } = await supabase
    .from('training_requests')
    .update({ status })
    .eq('id', requestId)
  return { data, error }
}

export const getMyTrainingRequests = async (userId: string) => {
  const { data, error } = await supabase
    .from('training_requests')
    .select('to_instructor_id, status')
    .eq('from_user_id', userId)
  return { data, error }
}

// Returns the training request between two users (either direction for instructors)
export const getRequestBetween = async (fromUserId: string, toInstructorId: string) => {
  const { data, error } = await supabase
    .from('training_requests')
    .select('id, status')
    .eq('from_user_id', fromUserId)
    .eq('to_instructor_id', toInstructorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

export const getInstructorCourses = async (instructorId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Videos by user
export const getUserVideos = async (userId: string) => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Instructor applications
export const submitInstructorApplication = async (
  userId: string,
  payload: {
    full_name: string
    topic: string
    bio: string
    role_type: string
    location?: string
    experience_years?: number
    employer?: string
    contact_email?: string
    contact_phone?: string
  }
) => {
  const { error } = await supabase
    .from('instructor_applications')
    .upsert([{ user_id: userId, ...payload, status: 'pending' }], { onConflict: 'user_id' })
  return { error }
}

export const getInstructorApplication = async (userId: string) => {
  const { data, error } = await supabase
    .from('instructor_applications')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export const getInstructors = async (roleType?: string) => {
  // Query users directly — avoids RLS restrictions on instructor_applications
  let q = supabase
    .from('users')
    .select('id, username, avatar_url, verified, title, bio, work_description, experience_years, instructor_role, followers_count')
    .eq('account_type', 'instructor')
  if (roleType) q = (q as any).eq('instructor_role', roleType)
  const { data, error } = await q
  if (!data) return { data, error }

  // Best-effort: enrich with application data (contact info etc.) — may be empty if RLS blocks it
  const userIds = (data as any[]).map((u: any) => u.id)
  const { data: apps } = userIds.length
    ? await supabase.from('instructor_applications').select('*').in('user_id', userIds)
    : { data: [] }
  const appMap: Record<string, any> = Object.fromEntries(((apps || []) as any[]).map((a: any) => [a.user_id, a]))

  const result = (data as any[]).map((u: any) => {
    const app = appMap[u.id] ?? {}
    return {
      id: app.id ?? u.id,
      user_id: u.id,
      full_name: app.full_name || u.username,
      role_type: app.role_type || u.instructor_role || 'mentor',
      topic: app.topic || u.title || '',
      bio: app.bio || u.bio || '',
      location: app.location || u.work_description || '',
      experience_years: app.experience_years ?? u.experience_years ?? null,
      contact_email: app.contact_email || '',
      contact_phone: app.contact_phone || '',
      created_at: app.created_at || u.created_at,
      users: {
        id: u.id,
        username: u.username,
        avatar_url: u.avatar_url,
        verified: u.verified,
        account_type: 'instructor',
        title: u.title,
        followers_count: u.followers_count ?? 0,
      },
    }
  })

  return { data: result, error }
}

export const getFollowingIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId)
  return data?.map((r: any) => r.following_id) ?? []
}

export const incrementProfileViews = async (userId: string) => {
  await supabase.rpc('increment_profile_views', { p_user_id: userId })
}

// Feedback
export const addFeedback = async (profileUserId: string, reviewerId: string, rating: number, text: string) => {
  const { data, error } = await supabase
    .from('feedback')
    .insert([{ profile_user_id: profileUserId, reviewer_id: reviewerId, rating, feedback_text: text }])
  return { data, error }
}

export const getFeedback = async (profileUserId: string) => {
  const { data, error } = await supabase
    .from('feedback').select('*').eq('profile_user_id', profileUserId).order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((f: any) => f.reviewer_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((f: any) => ({ ...f, users: map[f.reviewer_id] ?? null })), error }
}

// Course sessions
export const createCourseSessions = async (courseId: string, sessions: any[]) => {
  const { data, error } = await supabase
    .from('course_sessions')
    .insert(sessions)
    .select()
  return { data, error }
}

// Course ratings
export const rateCourse = async (courseId: string, userId: string, stars: number) => {
  const { error } = await supabase
    .from('course_ratings')
    .upsert([{ course_id: courseId, user_id: userId, rating: stars }], { onConflict: 'course_id,user_id' })
  if (!error) {
    const { data: all } = await supabase.from('course_ratings').select('rating').eq('course_id', courseId)
    if (all?.length) {
      const avg = Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10
      await supabase.from('courses').update({ rating: avg }).eq('id', courseId)
    }
  }
  return { error }
}

export const getUserCourseRating = async (courseId: string, userId: string) => {
  const { data, error } = await supabase
    .from('course_ratings')
    .select('rating')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

export const deleteComment = async (commentId: string, userId: string) => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)
  return { error }
}

// Workshop enrollments
export const joinWorkshop = async (workshopId: string, userId: string) => {
  const { error } = await supabase
    .from('workshop_enrollments')
    .insert([{ workshop_id: workshopId, user_id: userId }])
  return { error }
}

export const leaveWorkshop = async (workshopId: string, userId: string) => {
  const { error } = await supabase
    .from('workshop_enrollments')
    .delete()
    .eq('workshop_id', workshopId)
    .eq('user_id', userId)
  return { error }
}

export const hasJoinedWorkshop = async (workshopId: string, userId: string) => {
  const { data } = await supabase
    .from('workshop_enrollments')
    .select('id')
    .eq('workshop_id', workshopId)
    .eq('user_id', userId)
    .single()
  return { data: !!data }
}

export const getMyWorkshopJoins = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('workshop_enrollments')
    .select('workshop_id')
    .eq('user_id', userId)
  return (data || []).map((r: any) => r.workshop_id)
}

export const getFeedbackGiven = async (reviewerId: string) => {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((f: any) => f.profile_user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((f: any) => ({ ...f, recipient: map[f.profile_user_id] ?? null })), error }
}

// My sent training requests (as user to instructors)
export const getMyTrainingRequestsFull = async (userId: string) => {
  const { data, error } = await supabase
    .from('training_requests')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((r: any) => r.to_instructor_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((r: any) => ({ ...r, instructor: map[r.to_instructor_id] ?? null })), error }
}

// Messaging
export const getOrCreateConversation = async (myId: string, otherId: string) => {
  const u1 = myId < otherId ? myId : otherId
  const u2 = myId < otherId ? otherId : myId
  const { data: existing } = await supabase
    .from('conversations').select('*').eq('user1_id', u1).eq('user2_id', u2).single()
  if (existing) return { data: existing, error: null }
  const { data, error } = await supabase
    .from('conversations').insert([{ user1_id: u1, user2_id: u2 }]).select().single()
  return { data, error }
}

export const getConversations = async (userId: string) => {
  const { data, error } = await supabase
    .from('conversations').select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })
  if (!data) return { data: [], error }
  const otherIds = [...new Set(data.map((c: any) => c.user1_id === userId ? c.user2_id : c.user1_id))]
  const { data: usersData } = otherIds.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', otherIds)
    : { data: [] }
  const userMap = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  const lastMsgMap: Record<string, any> = {}
  for (const c of data) {
    const { data: msgs } = await supabase
      .from('messages').select('content, created_at, sender_id')
      .eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1)
    if (msgs?.[0]) lastMsgMap[c.id] = msgs[0]
  }
  return {
    data: data.map((c: any) => {
      const isUser1 = c.user1_id === userId
      const otherId = isUser1 ? c.user2_id : c.user1_id
      const isFavorite = isUser1 ? (c.is_favorite_user1 ?? false) : (c.is_favorite_user2 ?? false)
      const isDeleted  = isUser1 ? (c.deleted_by_user1  ?? false) : (c.deleted_by_user2  ?? false)
      return { ...c, otherUser: userMap[otherId] ?? null, lastMessage: lastMsgMap[c.id] ?? null, isFavorite, isUser1, isDeleted }
    }).filter((c: any) => !c.isDeleted),
    error
  }
}

export const deleteConversationForUser = async (conversationId: string, isUser1: boolean) => {
  const col = isUser1 ? 'deleted_by_user1' : 'deleted_by_user2'
  const { error } = await supabase.from('conversations').update({ [col]: true }).eq('id', conversationId)
  return { error }
}

export const setConversationFavorite = async (conversationId: string, isUser1: boolean, favorite: boolean) => {
  const col = isUser1 ? 'is_favorite_user1' : 'is_favorite_user2'
  const { error } = await supabase.from('conversations').update({ [col]: favorite }).eq('id', conversationId)
  return { error }
}

export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  return { error }
}

export const getMessages = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('messages').select('*').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((m: any) => m.sender_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((m: any) => ({ ...m, sender: map[m.sender_id] ?? null })), error }
}

export const sendMessage = async (conversationId: string, senderId: string, content: string) => {
  const { data, error } = await supabase
    .from('messages').insert([{ conversation_id: conversationId, sender_id: senderId, content }]).select().single()
  if (!error) {
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
  }
  return { data, error }
}

export const markMessagesRead = async (conversationId: string, userId: string) => {
  await supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).neq('sender_id', userId).is('read_at', null)
}

export const getUnreadMessageCount = async (userId: string): Promise<number> => {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, user1_id, deleted_by_user1, deleted_by_user2')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
  const convIds = (convs || [])
    .filter((c: any) => {
      const isUser1 = c.user1_id === userId
      return isUser1 ? !c.deleted_by_user1 : !c.deleted_by_user2
    })
    .map((c: any) => c.id)
  if (!convIds.length) return 0
  const { count } = await supabase
    .from('messages').select('id', { count: 'exact', head: true })
    .neq('sender_id', userId).is('read_at', null).in('conversation_id', convIds)
  return count ?? 0
}

export const setSessionLive = async (sessionId: string, isLive: boolean) => {
  const { error } = await supabase
    .from('course_sessions')
    .update({ is_live: isLive })
    .eq('id', sessionId)
  return { error }
}

export const completeSession = async (sessionId: string) => {
  const { error } = await supabase
    .from('course_sessions')
    .update({ is_live: false, is_completed: true })
    .eq('id', sessionId)
  return { error }
}

export const getLiveSessions = async () => {
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*, courses(id, title, thumbnail_url, instructor_id, users:instructor_id(username, avatar_url))')
    .eq('is_live', true)
  return { data, error }
}

export const getEnrolledCourses = async (userId: string) => {
  const { data: enrollmentData } = await supabase
    .from('enrollments').select('course_id').eq('user_id', userId)
  const courseIds = (enrollmentData || []).map((e: any) => e.course_id).filter(Boolean)
  if (!courseIds.length) return { data: [], error: null }
  const { data: coursesData, error } = await supabase
    .from('courses').select('*, course_sessions(*)').in('id', courseIds).eq('is_deleted', false)
  if (!coursesData) return { data: [], error }
  const instIds = [...new Set(coursesData.map((c: any) => c.instructor_id || c.user_id).filter(Boolean))]
  const { data: usersData } = instIds.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', instIds)
    : { data: [] }
  const userMap = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return {
    data: coursesData.map((c: any) => ({ ...c, users: userMap[c.instructor_id || c.user_id] ?? null })),
    error,
  }
}

export const getCoursesByInstructor = async (instructorId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, thumbnail_url, rating, enrolled_count, subject, level')
    .eq('instructor_id', instructorId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const deleteCourse = async (courseId: string, instructorId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .update({ is_deleted: true })
    .eq('id', courseId)
    .eq('instructor_id', instructorId)
    .select()
  return { data, error }
}

export const deleteWorkshop = async (workshopId: string, instructorId: string) => {
  const { error } = await supabase
    .from('workshops').delete().eq('id', workshopId).eq('instructor_id', instructorId)
  return { error }
}

export const setWorkshopLive = async (workshopId: string, isLive: boolean) => {
  const { error } = await supabase
    .from('workshops')
    .update({ is_live: isLive })
    .eq('id', workshopId)
  return { error }
}

export const getInstructorWorkshops = async (instructorId: string) => {
  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('workshop_date', { ascending: true })
  return { data, error }
}

// Jobs
export const createJob = async (job: {
  instructor_id: string
  title: string
  company?: string
  type: string
  salary?: string
  location?: string
  description?: string
  requirements?: string
  apply_link?: string
  tags?: string[]
}) => {
  const { data, error } = await supabase.from('jobs').insert([job]).select().single()
  return { data, error }
}

export const getJobs = async () => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, users:instructor_id(id, username, avatar_url, verified, followers_count)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getJobsByInstructor = async (instructorId: string) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const deleteJob = async (jobId: string, instructorId: string) => {
  const { error } = await supabase
    .from('jobs').delete().eq('id', jobId).eq('instructor_id', instructorId)
  return { error }
}

export const saveJob = async (userId: string, jobId: string) => {
  const { data, error } = await supabase.from('saved_jobs').insert([{ user_id: userId, job_id: jobId }])
  return { data, error }
}

export const unsaveJob = async (userId: string, jobId: string) => {
  const { error } = await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId)
  return { error }
}

export const getSavedJobs = async (userId: string) => {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('*, jobs(*, users:instructor_id(id, username, avatar_url, verified))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getSavedJobIds = async (userId: string) => {
  const { data } = await supabase
    .from('saved_jobs').select('job_id').eq('user_id', userId)
  return data?.map((r: any) => r.job_id) ?? []
}

// ── Course Projects ───────────────────────────────────────────

export const getCourseProject = async (courseId: string) => {
  const { data, error } = await supabase
    .from('course_projects')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle()
  return { data, error }
}

export const getCourseProjectBySession = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('course_projects')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  return { data, error }
}

export const updateCourseProject = async (
  projectId: string,
  payload: { title?: string; description?: string; due_date?: string; submission_mode?: string }
) => {
  const { data, error } = await supabase
    .from('course_projects')
    .update(payload)
    .eq('id', projectId)
    .select()
    .single()
  return { data, error }
}

export const gradeSubmission = async (
  submissionId: string,
  status: 'accepted' | 'declined',
  feedback?: string
) => {
  const { data, error } = await supabase
    .from('project_submissions')
    .update({ status, feedback: feedback ?? null })
    .eq('id', submissionId)
    .select()
    .single()
  return { data, error }
}

export const createCourseProject = async (
  instructorId: string,
  courseId: string,
  payload: { title: string; description?: string; due_date?: string }
) => {
  const { data: courseRow } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  const { data, error } = await supabase
    .from('course_projects')
    .insert([{ instructor_id: instructorId, ...(courseRow?.id ? { course_id: courseRow.id } : {}), ...payload }])
    .select()
    .single()
  return { data, error }
}

export const getProjectSubmissions = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (!data) return { data, error }
  const ids = [...new Set(data.map((s: any) => s.user_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return { data: data.map((s: any) => ({ ...s, user: map[s.user_id] ?? null })), error }
}

export const getMyProjectSubmission = async (userId: string, projectId: string) => {
  const { data, error } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle()
  return { data, error }
}

export const submitCourseProject = async (
  userId: string,
  projectId: string,
  courseId: string,
  payload: { file_url?: string; file_type?: string; description?: string }
) => {
  const { data: courseRow } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()

  const { data, error } = await supabase
    .from('project_submissions')
    .upsert([{ user_id: userId, project_id: projectId, ...(courseRow?.id ? { course_id: courseRow.id } : {}), status: 'pending', ...payload }],
      { onConflict: 'project_id,user_id' })
    .select()
    .single()
  return { data, error }
}

export const updateSubmissionStatus = async (
  submissionId: string,
  status: 'accepted' | 'declined',
  feedback?: string
) => {
  const { data, error } = await supabase
    .from('project_submissions')
    .update({ status, feedback: feedback ?? null })
    .eq('id', submissionId)
    .select()
    .single()
  return { data, error }
}

// ── Project showcase (published, accepted projects) ───────────

// Existing published showcase for this user on a course (null if not yet published)
export const getMyProjectShowcase = async (userId: string, courseId: string) => {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  return data
}

// Publish an accepted project to the showcase (public = feed + showcase, private = employer/instructor-only showcase)
export const publishProjectShowcase = async (
  userId: string,
  payload: {
    course_id: string
    title: string
    description?: string
    visibility: 'public' | 'private'
    attachment_url?: string
    attachment_type?: string
  }
) => {
  const row: any = { user_id: userId, ...payload }
  let { data, error } = await supabase.from('projects').insert([row]).select().single()
  // Fall back if the attachment columns haven't been added yet (migration not run)
  if (error) {
    const { attachment_url, attachment_type, ...minimal } = row
    const retry = await supabase.from('projects').insert([minimal]).select().single()
    data = retry.data; error = retry.error
  }
  return { data, error }
}

// ── Organisations ─────────────────────────────────────────────

export const getMyOrganisation = async (userId: string) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('admin_user_id', userId)
    .maybeSingle()
  return { data, error }
}

export const getOrgBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  return { data, error }
}

export const getOrgByCode = async (code: string) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('join_code', code.toUpperCase().trim())
    .maybeSingle()
  return { data, error }
}

export const getMyOrgMembership = async (userId: string) => {
  const { data, error } = await supabase
    .from('organisation_members')
    .select('*, organisations(*)')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

export const joinOrganisation = async (userId: string, orgId: string) => {
  const { data, error } = await supabase
    .from('organisation_members')
    .insert([{ organisation_id: orgId, user_id: userId, role: 'student' }])
    .select()
    .single()
  return { data, error }
}

export const getOrgMembers = async (orgId: string) => {
  const { data, error } = await supabase
    .from('organisation_members')
    .select('*, users(id, username, avatar_url, verified)')
    .eq('organisation_id', orgId)
    .order('joined_at', { ascending: false })
  return { data, error }
}

export const getOrgCourses = async (orgId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .select('*, users(id, username, avatar_url, verified)')
    .eq('organisation_id', orgId)
    .eq('visibility', 'private')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createOrganisation = async (
  adminId: string,
  payload: { name: string; slug: string; join_code: string; logo_url?: string }
) => {
  const { data, error } = await supabase
    .from('organisations')
    .insert([{ admin_user_id: adminId, ...payload }])
    .select()
    .single()
  return { data, error }
}

export const getAllOrganisations = async () => {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .order('name', { ascending: true })
  return { data, error }
}

// Employer-safe discovery: independent adults only — anyone belonging to an
// organisation is only reachable via the Organisations tab (routed through
// their org admin), regardless of age. This is the safeguarding boundary.
export const getEmployerDiscoverableUsers = async () => {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const [{ data: users, error }, { data: members }] = await Promise.all([
    supabase
      .from('users')
      .select('id, username, avatar_url, verified, title, bio, work_description, skills, date_of_birth, followers_count')
      .eq('account_type', 'student')
      .lte('date_of_birth', cutoffStr)
      .order('followers_count', { ascending: false }),
    supabase.from('organisation_members').select('user_id'),
  ])
  if (!users) return { data: [], error }
  const orgUserIds = new Set((members ?? []).map((m: any) => m.user_id))
  return { data: users.filter(u => !orgUserIds.has(u.id)), error: null }
}

// Sends employer interest either directly to an independent adult, or — if
// the target belongs to an organisation — to that org's admin instead, with
// about_user_id recording who the interest is actually about.
export const expressEmployerInterest = async (employerId: string, targetUserId: string, message: string) => {
  const { data: membership } = await supabase
    .from('organisation_members')
    .select('organisations(admin_user_id)')
    .eq('user_id', targetUserId)
    .maybeSingle()
  const orgAdminId = (membership as any)?.organisations?.admin_user_id as string | undefined

  const { data, error } = await supabase
    .from('training_requests')
    .insert([{
      from_user_id: employerId,
      to_instructor_id: orgAdminId ?? targetUserId,
      about_user_id: orgAdminId ? targetUserId : null,
      type: 'employer_interest',
      message,
      status: 'pending',
    }])
    .select()
    .single()
  return { data, error, routedToOrgAdmin: !!orgAdminId }
}

// Employers can't see anyone else's response until now — this is their own
// "sent" outbox, tracking who each expression of interest was really about
// (about_user_id when org-routed, else the direct recipient) and its status.
export const getMyExpressedInterest = async (employerId: string) => {
  const { data, error } = await supabase
    .from('training_requests')
    .select('*')
    .eq('from_user_id', employerId)
    .eq('type', 'employer_interest')
    .order('created_at', { ascending: false })
  if (!data) return { data: null, error }
  const ids = [...new Set(data.map((r: any) => r.about_user_id ?? r.to_instructor_id).filter(Boolean))]
  const { data: usersData } = ids.length
    ? await supabase.from('users').select('id, username, avatar_url, verified').in('id', ids)
    : { data: [] }
  const map = Object.fromEntries(((usersData || []) as any[]).map(u => [u.id, u]))
  return {
    data: data.map((r: any) => ({ ...r, target: map[r.about_user_id ?? r.to_instructor_id] ?? null })),
    error,
  }
}

export const getInstructorDashboardStats = async (instructorId: string) => {
  const [{ data: courses }, { data: workshops }] = await Promise.all([
    supabase.from('courses').select('id, title, enrolled_count, thumbnail_url').eq('instructor_id', instructorId),
    supabase.from('workshops').select('id, title, enrolled_count, thumbnail_url').eq('instructor_id', instructorId),
  ])
  const courseIds = (courses || []).map((c: any) => c.id)
  const { data: projects } = courseIds.length
    ? await supabase.from('course_projects').select('*').in('course_id', courseIds)
    : { data: [] }
  const projectIds = (projects || []).map((p: any) => p.id)
  const { data: submissions } = projectIds.length
    ? await supabase.from('project_submissions').select('*').in('project_id', projectIds)
    : { data: [] }
  const submitterIds = [...new Set((submissions || []).map((s: any) => s.user_id))]
  const { data: submitters } = submitterIds.length
    ? await supabase.from('users').select('id, username, avatar_url').in('id', submitterIds)
    : { data: [] }
  const userMap = Object.fromEntries(((submitters || []) as any[]).map(u => [u.id, u]))
  const projectMap = Object.fromEntries(((projects || []) as any[]).map(p => [p.id, p]))
  const submissionsWithUser = (submissions || []).map((s: any) => ({
    ...s,
    user: userMap[s.user_id] ?? null,
    project: projectMap[s.project_id] ?? null,
  }))
  const totalEnrolled = (courses || []).reduce((s: number, c: any) => s + (c.enrolled_count || 0), 0)
  const totalWorkshopJoins = (workshops || []).reduce((s: number, w: any) => s + (w.enrolled_count || 0), 0)
  return {
    courses: courses || [],
    workshops: workshops || [],
    projects: projects || [],
    submissions: submissionsWithUser,
    totalEnrolled,
    totalWorkshopJoins,
  }
}