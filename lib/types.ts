// v2 schema types — see supabase/migrations/2026-08-26-rebuild-schema-v2.sql
// onward for the source of truth. Every user is exactly one role; the
// role decides what they can see and do (enforced in RLS, not here).

export type Role = 'student' | 'institution_staff' | 'provider_staff' | 'employer'
export type OrgType = 'institution' | 'provider'

export interface User {
  id: string
  role: Role
  full_name: string
  email: string
  date_of_birth?: string
  organisation_id?: string
  sidebar_collapsed?: boolean
  created_at: string
}

export interface Organisation {
  id: string
  name: string
  type: OrgType
  safeguarding_lead_id?: string
  created_at: string
}

// Student/employer-safe: name only, never `type` — matches the
// organisations_public view (org type is never shown to students).
export interface OrganisationPublic {
  id: string
  name: string
}

export interface JoinCode {
  id: string
  organisation_id: string
  code: string
  expires_at?: string
  revoked: boolean
  created_by?: string
  created_at: string
}

export interface WorkItem {
  id: string
  organisation_id: string
  type: 'brief' | 'course' | 'workshop'
  title: string
  description?: string
  criteria: string
  visibility: 'public' | 'private'
  created_by?: string
  created_at: string
}

export interface Enrolment {
  id: string
  student_id: string
  work_item_id: string
  joined_at: string
}

export type SubmissionStatus = 'submitted' | 'returned' | 'verified' | 'revoked'
export type ModerationStatus = 'clear' | 'flagged' | 'hidden'

export interface Submission {
  id: string
  student_id: string
  work_item_id: string
  content?: string
  file_type?: string
  file_size_bytes?: number
  moderation_status: ModerationStatus
  flagged_reason?: string
  status: SubmissionStatus
  submitted_at: string
  users?: User
  work_items?: WorkItem
}

export type ReviewDecision = 'verified' | 'returned' | 'revoked'

export interface Review {
  id: string
  submission_id: string
  reviewer_id: string
  feedback?: string
  decision: ReviewDecision
  created_at: string
  users?: User
}

export type ShareVisibility = 'organisation' | 'public'

export interface Verification {
  id: string
  submission_id: string
  verified_by: string
  verified_at: string
  visibility: ShareVisibility
  revoked_at?: string
  revoked_by?: string
  revocation_reason?: string
  users?: User
}

export interface Opportunity {
  id: string
  employer_id: string
  title: string
  description?: string
  created_at: string
}

export type InterestStatus = 'pending' | 'accepted' | 'declined'

export interface Interest {
  id: string
  employer_id: string
  student_id: string
  status: InterestStatus
  org_notified_at?: string
  created_at: string
}

export type NotificationType = 'submission_received' | 'work_returned' | 'work_verified' | 'work_revoked'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  submission_id?: string
  read: boolean
  created_at: string
}
