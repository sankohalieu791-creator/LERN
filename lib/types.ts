export interface User {
  id: string
  email: string
  username: string
  avatar_url?: string
  bio?: string
  title?: string
  work_description?: string
  phone_number?: string
  account_type: 'student' | 'instructor' | 'employer'
  is_instructor: boolean
  is_employer: boolean
  verified: boolean
  followers_count: number
  following_count: number
  views_count: number
  dark_mode: boolean
  notif_push_enabled: boolean
  notif_email_enabled: boolean
  notif_course_reminders: boolean
  instructor_role?: 'mentor' | 'professor' | 'teacher' | 'coach'
  experience_years?: number
  created_at: string
}

export interface InstructorApplication {
  id: string
  user_id: string
  full_name: string
  topic: string
  bio: string
  role_type: 'mentor' | 'professor' | 'teacher' | 'coach'
  location?: string
  experience_years?: number
  contact_email?: string
  contact_phone?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  users?: User
}

export interface Video {
  id: string
  user_id: string
  title: string
  description: string
  thumbnail_url?: string
  video_url?: string
  duration: string
  subject: string
  views: number
  likes_count: number
  comments_count: number
  is_live: boolean
  stream_url?: string
  created_at: string
  users?: User
}

export interface Course {
  id: string
  instructor_id: string
  title: string
  description: string
  thumbnail_url?: string
  subject: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_weeks: number
  rating: number
  enrolled_count: number
  created_at: string
  users?: User
  course_sessions?: CourseSession[]
}

export interface CourseSession {
  id: string
  course_id: string
  session_number: number
  title: string
  description: string
  session_date: string
  session_time: string
  is_live: boolean
  is_project_day: boolean
  created_at: string
}

export interface Workshop {
  id: string
  instructor_id: string
  title: string
  description: string
  thumbnail_url?: string
  workshop_date: string
  workshop_time: string
  location: string
  is_online: boolean
  max_participants: number
  enrolled_count: number
  is_live: boolean
  stream_url?: string
  created_at: string
  users?: User
}

export interface Project {
  id: string
  user_id: string
  course_id?: string
  title: string
  description: string
  visibility: 'private' | 'public'
  created_at: string
}

export interface ProjectSubmission {
  id: string
  project_id: string
  submission_text: string
  attachment_url?: string
  status: 'pending' | 'approved' | 'needs_work'
  instructor_feedback?: string
  submitted_at: string
}

export interface Certificate {
  id: string
  user_id: string
  title: string
  issuer: string
  year: number
  certificate_url: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'like' | 'comment' | 'follow'
  related_user_id?: string
  video_id?: string
  read: boolean
  created_at: string
}

export interface Feedback {
  id: string
  profile_user_id: string
  reviewer_id: string
  rating: number
  feedback_text: string
  created_at: string
}

export interface Comment {
  id: string
  video_id: string
  user_id: string
  text: string
  created_at: string
  users?: User
}
