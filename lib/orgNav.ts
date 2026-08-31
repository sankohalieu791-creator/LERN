import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard, Briefcase, Search, Megaphone, HeartHandshake } from 'lucide-react'
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

// Independent employer sidebar — Feed, Discover, Briefs, Opportunities,
// Candidates, Dashboard, per the "Employer side (two types) +
// connections" spec. ("Job Tracker" from the earlier draft is the same
// place as "Candidates" here — renamed to match, not a new page.)
// This nav is never shown to a guest employer (Type 1) — see
// GuestEmployerShell, which replaces OrgShell entirely for them.
export const employerSections: NavItem[] = [
  { key: 'feed',           label: 'Feed',          icon: Home,            href: '/employer/feed' },
  { key: 'discover',       label: 'Discover',      icon: Search,          href: '/employer/discover' },
  { key: 'briefs',         label: 'Briefs',        icon: FileText,        href: '/employer/briefs' },
  { key: 'opportunities',  label: 'Opportunities', icon: Megaphone,       href: '/employer/opportunities' },
  { key: 'candidates',     label: 'Candidates',    icon: Briefcase,       href: '/employer/candidates' },
  { key: 'dashboard',      label: 'Dashboard',     icon: LayoutDashboard, href: '/employer/dashboard' },
]

export const employerPhoneItems: [NavItem, NavItem, NavItem] = [
  employerSections[1], // Discover
  employerSections[3], // Opportunities
  employerSections[5], // Dashboard
]
