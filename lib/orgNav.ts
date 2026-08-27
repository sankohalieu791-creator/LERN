import { Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, LayoutDashboard, Briefcase } from 'lucide-react'
import type { NavItem } from '@/components/v2/OrgShell'

// Review is its own section for both roles now — Job tracking too (not
// live yet, but reachable as its own place rather than buried as a card
// inside Dashboard).
export const institutionSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/institution/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/institution/review' },
  { key: 'students',  label: 'Students',  icon: Users,           href: '/institution/students' },
  { key: 'briefs',    label: 'Briefs',    icon: FileText,        href: '/institution/briefs' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/institution/workshops' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/institution/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/institution/dashboard' },
]

export const institutionPhoneItems: [NavItem, NavItem, NavItem] = [
  institutionSections[0], // Feed
  institutionSections[3], // Briefs
  institutionSections[6], // Dashboard
]

export const providerSections: NavItem[] = [
  { key: 'feed',      label: 'Feed',      icon: Home,            href: '/provider/feed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck,  href: '/provider/review' },
  { key: 'courses',   label: 'Courses',   icon: BookOpen,        href: '/provider/courses' },
  { key: 'workshops', label: 'Workshops', icon: Presentation,    href: '/provider/workshops' },
  { key: 'jobs',      label: 'Job tracking', icon: Briefcase,    href: '/provider/jobs' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/provider/dashboard' },
]

export const providerPhoneItems: [NavItem, NavItem, NavItem] = [
  providerSections[0], // Feed
  providerSections[2], // Courses
  providerSections[5], // Dashboard
]
