import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard, Briefcase, Search, Megaphone, HeartHandshake, Inbox, Bookmark, Building2 } from 'lucide-react'
import type { NavItem } from '@/components/v2/OrgShell'

// Review is its own section for both roles now — Job tracking too (not
// live yet, but reachable as its own place rather than buried as a card
// inside Dashboard). Interest received: employers expressing interest
// in a student — the only place an under-18's interest is ever visible
// at all (RLS gives the student themselves no read path to it), staff
// accept/decline on their behalf; for 18+ students it's also visible
// to them directly in their own Discover.
export const institutionSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/institution/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/institution/review' },
  { key: 'students',  label: 'Students',  icon: Users,           href: '/institution/students' },
  { key: 'briefs',    label: 'Briefs',    icon: FileText,        href: '/institution/briefs' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/institution/workshops' },
  { key: 'interest',  label: 'Interest received', icon: HeartHandshake, href: '/institution/interest' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/institution/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/institution/dashboard' },
]

export const institutionPhoneItems: [NavItem, NavItem, NavItem] = [
  institutionSections[0], // Feed
  institutionSections[3], // Briefs
  institutionSections[7], // Dashboard
]

export const providerSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/provider/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/provider/review' },
  { key: 'courses',   label: 'Courses',   icon: BookOpen,        href: '/provider/courses' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/provider/workshops' },
  { key: 'interest',  label: 'Interest received', icon: HeartHandshake, href: '/provider/interest' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/provider/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/provider/dashboard' },
]

export const providerPhoneItems: [NavItem, NavItem, NavItem] = [
  providerSections[0], // Feed
  providerSections[2], // Courses
  providerSections[6], // Dashboard
]

// Independent employer sidebar — Complete Build Spec v1.0, Part 3's
// exact eight items and order (Feed, Discover, Jobs, Candidates,
// Inbox, Talent pools, Partners, Dashboard), with Briefs kept right
// after Feed -- real, already-shipped functionality the spec's list
// just doesn't re-mention, not something to delete because a newer,
// narrower-scoped spec didn't name it. "Opportunities" renamed to
// "Jobs" to match the spec's exact label ("The posting button is
// called Jobs, not Discover... keep these two separate and named
// exactly this way") -- same page underneath, label only.
// This nav is never shown to a guest employer (Type 1) — see
// GuestEmployerShell, which replaces OrgShell entirely for them.
export const employerSections: NavItem[] = [
  { key: 'feed',          label: 'Feed',         icon: Home,            href: '/employer/feed' },
  { key: 'briefs',        label: 'Briefs',       icon: FileText,        href: '/employer/briefs' },
  { key: 'discover',      label: 'Discover',     icon: Search,          href: '/employer/discover' },
  { key: 'jobs',          label: 'Jobs',         icon: Megaphone,       href: '/employer/opportunities' },
  { key: 'candidates',    label: 'Candidates',   icon: Briefcase,       href: '/employer/candidates' },
  { key: 'inbox',         label: 'Inbox',        icon: Inbox,           href: '/employer/inbox' },
  { key: 'talent-pools',  label: 'Talent pools', icon: Bookmark,        href: '/employer/talent-pools' },
  { key: 'partners',      label: 'Partners',     icon: Building2,       href: '/employer/partners' },
  { key: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard, href: '/employer/dashboard' },
]

export const employerPhoneItems: [NavItem, NavItem, NavItem] = [
  employerSections[2], // Discover
  employerSections[4], // Candidates
  employerSections[8], // Dashboard
]
