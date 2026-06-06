import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth
export const signUp = async (email: string, password: string, username: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  })
  if (!error && data.user) {
    await createUserProfile(data.user.id, username, email)
  }
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

// Users
export const createUserProfile = async (userId: string, username: string, email: string) => {
  const { data, error } = await supabase
    .from('users')
    .insert([{ id: userId, username, email, account_type: 'student' }])
  return { data, error }
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
    .select('*, users(*)')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getVideoById = async (videoId: string) => {
  const { data, error } = await supabase
    .from('videos')
    .select('*, users(*)')
    .eq('id', videoId)
    .single()
  return { data, error }
}

export const createVideo = async (userId: string, videoData: any) => {
  const { data, error } = await supabase
    .from('videos')
    .insert([{ user_id: userId, ...videoData }])
  return { data, error }
}

// Courses
export const getCourses = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select('*, users(*)')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getCourseById = async (courseId: string) => {
  const { data, error } = await supabase
    .from('courses')
    .select('*, users(*), course_sessions(*)')
    .eq('id', courseId)
    .single()
  return { data, error }
}

export const createCourse = async (instructorId: string, courseData: any) => {
  const { data, error } = await supabase
    .from('courses')
    .insert([{ instructor_id: instructorId, user_id: instructorId, ...courseData }])
    .select()
  return { data, error }
}

export const enrollCourse = async (courseId: string, userId: string) => {
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
    .select('*, users(*)')
    .order('workshop_date', { ascending: true })
  return { data, error }
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
export const followUser = async (followerId: string, followingId: string) => {
  const { data, error } = await supabase
    .from('followers')
    .insert([{ follower_id: followerId, following_id: followingId }])
  return { data, error }
}

export const unfollowUser = async (followerId: string, followingId: string) => {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
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

// Comments
export const addComment = async (videoId: string, userId: string, text: string) => {
  const { data, error } = await supabase
    .from('comments')
    .insert([{ video_id: videoId, user_id: userId, text }])
  return { data, error }
}

export const getComments = async (videoId: string) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*, users(*)')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
  return { data, error }
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
  link?: string
) => {
  await supabase.from('notifications').insert([{ user_id: userId, type, title, body, link }])
}

export const markNotificationsRead = async (userId: string) => {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
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
    .select('*, requester:from_user_id(id, username, avatar_url, verified)')
    .eq('to_instructor_id', instructorId)
    .order('created_at', { ascending: false })
  return { data, error }
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
    .select('to_instructor_id')
    .eq('from_user_id', userId)
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
    contact_email?: string
    contact_phone?: string
  }
) => {
  const { data, error } = await supabase
    .from('instructor_applications')
    .upsert([{ user_id: userId, ...payload, status: 'pending' }], { onConflict: 'user_id' })
    .select()
    .single()
  return { data, error }
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
  let q = supabase
    .from('instructor_applications')
    .select('*, users(*)')
    .order('created_at', { ascending: false })
  if (roleType) q = q.eq('role_type', roleType)
  return q
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
    .from('feedback')
    .select('*, users(*)')
    .eq('profile_user_id', profileUserId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Course sessions
export const createCourseSessions = async (courseId: string, sessions: any[]) => {
  const { data, error } = await supabase
    .from('course_sessions')
    .insert(sessions)
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
    .single()
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
    .select('*, recipient:profile_user_id(id, username, avatar_url, verified)')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const setSessionLive = async (sessionId: string, isLive: boolean) => {
  const { error } = await supabase
    .from('course_sessions')
    .update({ is_live: isLive })
    .eq('id', sessionId)
  return { error }
}