import type { LucideIcon } from 'lucide-react'
import {
  Home, ClipboardCheck, Users, FileText, BookOpen, Presentation, Briefcase,
  HeartHandshake, HardHat, Award, Search, Bookmark, Megaphone, Inbox,
} from 'lucide-react'

// Onboarding tour content, 24 Sep 2026 -- one tailored walkthrough per
// org role, kept short (5-6 steps) and built from the real nav items
// each role actually has, not a generic tour. The headline reason that
// role buys (Work Experience / Bootcamp Evidence / Talent pools) gets
// its own step even though it's only the second nav item, since it's
// the thing worth explaining first.
export interface OnboardingStep {
  icon: LucideIcon
  heading: string
  body: string
}

export const ONBOARDING_STEPS: Record<'institution' | 'provider' | 'employer', OnboardingStep[]> = {
  institution: [
    { icon: Home, heading: 'Your feed', body: "See what's happening across your school — student work, wins, and updates, all in one place." },
    { icon: HardHat, heading: 'Work Experience', body: "Track every placement: who's placed, who still needs one, and their day-by-day attendance — exportable for Ofsted or your trust." },
    { icon: ClipboardCheck, heading: 'Review', body: "Verify a student's submitted work here — this is the one step that unlocks it on their profile." },
    { icon: Users, heading: 'Students', body: "Your roster, a classroom attendance register, and a way to invite one employer in to see a single student's work." },
    { icon: FileText, heading: 'Briefs & Workshops', body: 'Set a brief for students to complete, or run a live workshop — both verified the same way as any other work.' },
    { icon: Briefcase, heading: 'Job tracking', body: 'Every application your students make, and every employer response, tracked through to an outcome.' },
  ],
  provider: [
    { icon: Home, heading: 'Your feed', body: "See what's happening across your organisation — learner work, wins, and updates, all in one place." },
    { icon: Award, heading: 'Bootcamp Evidence', body: "Attendance, course completion, and interview outcome, pulled together automatically into one exportable record per learner — nothing to enter twice." },
    { icon: ClipboardCheck, heading: 'Review', body: "Verify a learner's submitted work here — this is the one step that unlocks it on their profile." },
    { icon: Users, heading: 'Students', body: 'Your roster, attendance register, and a way to invite one employer in to see a single learner\'s work.' },
    { icon: BookOpen, heading: 'Courses & Workshops', body: 'Run a course or a live workshop — assign a group to a course to turn it into a trackable Bootcamp Evidence cohort.' },
    { icon: Briefcase, heading: 'Job tracking', body: 'Every application your learners make, and every employer response, tracked through to an outcome.' },
  ],
  employer: [
    { icon: Search, heading: 'Discover', body: "Browse verified student and learner work — nothing shows here until it's actually been checked by a tutor." },
    { icon: Bookmark, heading: 'Talent pools', body: "Save a candidate to a pool and LERN keeps them warm automatically — a profile prompt, a workshop invite, a check-in, all sent on a schedule. You only ever add or remove someone." },
    { icon: Megaphone, heading: 'Jobs', body: 'Post a role and manage who applies, from first interest through to an offer.' },
    { icon: Briefcase, heading: 'Candidates', body: 'Every candidate across every role you\'re hiring for, in one board.' },
    { icon: Inbox, heading: 'Inbox', body: "Messages with a candidate's school or provider — every conversation goes through them first, never straight to a student." },
    { icon: HeartHandshake, heading: "You're set up", body: 'That\'s the full picture. Everything here is built to need as little of your time as possible.' },
  ],
}

export const ONBOARDING_INTRO: Record<'institution' | 'provider' | 'employer', { heading: string; body: string }> = {
  institution: { heading: 'Welcome to LERN', body: "Let's show you around your school's dashboard, or jump straight in if you'd rather explore yourself." },
  provider: { heading: 'Welcome to LERN', body: "Let's show you around your dashboard, or jump straight in if you'd rather explore yourself." },
  employer: { heading: 'Welcome to LERN', body: "Let's show you around, or jump straight in if you'd rather explore yourself." },
}
