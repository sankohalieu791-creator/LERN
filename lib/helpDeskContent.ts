// LERN Help Desk -- knowledge base, 7 Oct 2026.
//
// Not AI. Every answer here is written by hand, by someone who knows
// the real product -- nothing is generated, nothing is guessed. The
// widget that reads this (components/v2/HelpDesk.tsx) just searches
// this list for the entry that best matches what was typed and shows
// its answer verbatim. If nothing matches well enough, it says so
// rather than showing a weak match dressed up as a real answer -- see
// searchHelp's MIN_SCORE. That's the whole point of it not being AI:
// everything it says is something a real person already decided was
// correct and worth saying, not a best guess assembled on the spot.
//
// Keep each answer to what a person would actually say out loud if
// someone stopped them in a corridor and asked -- plain, short
// paragraphs, no jargon that isn't explained, no marketing language.

export type HelpRole = 'institution_staff' | 'provider_staff' | 'employer'

export type HelpEntry = {
  id: string
  roles: HelpRole[]
  question: string
  keywords: string[]
  answer: string
}

export const HELP_ENTRIES: HelpEntry[] = [
  // ── Feed ──────────────────────────────────────────────────────────
  {
    id: 'feed-what',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'What is the Feed?',
    keywords: ['feed', 'wall', 'posts', 'wins', 'stories'],
    answer: "The Feed is the shared wall for your organisation. Staff and students post wins there, and nothing shows until a member of staff has checked it. The small circles along the top (\"wins\") disappear after 24 hours, like a story; the posts underneath stay. A reported post is hidden the instant it's reported, before anyone decides anything.",
  },
  {
    id: 'feed-report',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I deal with a reported post?',
    keywords: ['report', 'reported', 'hidden', 'moderate', 'moderation', 'flagged'],
    answer: "A reported post is hidden automatically the moment it's reported — you don't need to do anything for it to come down. To actually decide on it, go to the post in Feed; staff see a \"Reported\" tag and can restore it or remove it for good. Nothing is ever decided by the system on its own.",
  },
  {
    id: 'feed-win',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I post a win?',
    keywords: ['win', 'add win', 'post', 'story'],
    answer: 'Tap "Add win" at the top of the Feed. A win can be a photo or a short video (20 seconds max), tagged with what it is — a new job, an interview, work getting verified, and so on. It shows for 24 hours and then disappears on its own.',
  },

  // ── Work Experience / Bootcamp Evidence ─────────────────────────────
  {
    id: 'workexp-what',
    roles: ['institution_staff'],
    question: 'What is Work Experience?',
    keywords: ['work experience', 'placement', 'placed', 'employer placement'],
    answer: "Work Experience is where you track which employer each student is placed with, for how long, and their attendance while they're out on placement. That attendance is kept separately from the classroom register, since it's a different thing to track.",
  },
  {
    id: 'workexp-mark-attendance',
    roles: ['institution_staff'],
    question: 'How do I mark placement attendance?',
    keywords: ['attendance', 'present', 'absent', 'placement attendance', 'mark'],
    answer: "Open Work Experience, tap the student's placement, and mark each day present or absent there. It's separate from the classroom attendance register on purpose — a student can be marked present in class and still need their placement attendance recorded separately, or vice versa.",
  },
  {
    id: 'workexp-export',
    roles: ['institution_staff'],
    question: 'How do I export placement evidence?',
    keywords: ['export', 'placement evidence', 'csv', 'download', 'ofsted', 'mis'],
    answer: 'On Work Experience, the "Export placement evidence" button at the bottom downloads a CSV with every student, their employer, placement dates, and attendance — ready to hand to your MIS or an Ofsted return. If it ever doesn\'t download, it\'s almost always your browser silently blocking the file — try a different browser or check your download settings.',
  },
  {
    id: 'bootcamp-what',
    roles: ['provider_staff'],
    question: 'What is Bootcamp Evidence?',
    keywords: ['bootcamp evidence', 'bootcamp', 'funding evidence'],
    answer: "Bootcamp Evidence pulls together attendance against a 10-day threshold, course completion, and interview outcome for each learner — built automatically from work you're already recording in Review, Workshops, and Job tracking, so nothing gets entered twice. At the end of a cohort it exports as one record per learner.",
  },
  {
    id: 'bootcamp-enable',
    roles: ['provider_staff'],
    question: 'How do I turn on Bootcamp Evidence?',
    keywords: ['enable bootcamp', 'turn on bootcamp', 'bootcamp toggle'],
    answer: "Bootcamp Evidence is a training-provider feature, so it's only available to provider accounts, not institutions. There's a toggle for it on your Dashboard or in Settings — turning it on starts tracking automatically from your existing Courses, Review and Job tracking data; nothing needs re-entering.",
  },
  {
    id: 'bootcamp-export',
    roles: ['provider_staff'],
    question: 'How do I export funding evidence?',
    keywords: ['export funding', 'funding evidence', 'csv', 'download'],
    answer: "On Bootcamp Evidence, there's an export button that downloads one CSV row per learner, per cohort — attendance, completion, and interview outcome. If the download doesn't start, try a different browser; some browsers block automatic downloads from a script by default.",
  },

  // ── Review ───────────────────────────────────────────────────────
  {
    id: 'review-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What is Review?',
    keywords: ['review', 'verify', 'verification', 'queue'],
    answer: "Review is where staff check a student or learner's submitted work before it counts as \"verified\". The queue shows what's waiting, and flags anything overdue. Once you verify a piece of work, it moves onto that person's profile automatically — nothing else to do.",
  },
  {
    id: 'review-verify',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I verify a submission?',
    keywords: ['verify work', 'verify submission', 'approve', 'mark verified'],
    answer: 'Open Review, pick a submission from the queue, check it against the brief\'s criteria, and tap "Verify". It moves onto the student or learner\'s profile straight away, and off your queue.',
  },
  {
    id: 'review-return',
    roles: ['institution_staff', 'provider_staff'],
    question: "How do I return work that isn't ready?",
    keywords: ['return work', 'reject', 'not good enough', 'resubmit', 'feedback'],
    answer: 'In Review, open the submission and choose "Return" instead of "Verify", with a short note on what needs changing. It goes back to the student or learner as "Returned" with your note attached, and they can resubmit once it\'s fixed.',
  },

  // ── Students / roster ────────────────────────────────────────────
  {
    id: 'students-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What is the Students page?',
    keywords: ['students page', 'roster', 'class list', 'learners'],
    answer: "Students is the roster for your whole organisation, grouped by class or cohort — each student's verified work count and their own attendance register, all in one list.",
  },
  {
    id: 'students-filter-group',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I filter students by group?',
    keywords: ['filter by group', 'filter students', 'group filter', 'class filter'],
    answer: 'There\'s a "Filter by group" dropdown at the top of the Students page, next to the student count. Pick a class or group and the list narrows to just that group.',
  },
  {
    id: 'students-add-group',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I create a new group or class?',
    keywords: ['new group', 'create group', 'new class', 'add group'],
    answer: 'On Students, use "New group" to create a class or cohort, then assign students to it. A student can only belong to one group at a time.',
  },
  {
    id: 'students-join-code',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do students join my organisation?',
    keywords: ['join code', 'invite students', 'student code', 'sign up students'],
    answer: 'Your organisation has a join code (find it on your Dashboard) that students enter when they sign up. Anyone under 13 needs that code specifically — LERN won\'t let a child that young create an account without one, since it means your organisation is the one responsible for their account, not the child alone.',
  },

  // ── Guest invite ─────────────────────────────────────────────────
  {
    id: 'guest-invite-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What is Guest invite?',
    keywords: ['guest invite', 'guest link', 'share with employer'],
    answer: "Guest invite lets you show one employer a specific student's (or a few students') verified work through a single link — no LERN account needed on their end, and nothing else on the platform is visible to them. You can revoke the link at any time.",
  },
  {
    id: 'guest-invite-create',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I create a guest invite?',
    keywords: ['create guest invite', 'invite link', 'new invite'],
    answer: "Open Guest invite, tick the student (or students) you want to show, add the employer's email if you have it, and tap \"Create invite link\". Copy the link and send it however you'd normally contact that employer — email, a message, whatever's easiest.",
  },
  {
    id: 'guest-invite-revoke',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I revoke a guest invite?',
    keywords: ['revoke guest invite', 'cancel invite', 'disable link'],
    answer: 'On Guest invite, find the link in your list of sent invites and revoke it there. Once revoked, the link stops working immediately — anyone who had it can no longer open it.',
  },

  // ── Briefs / Courses ─────────────────────────────────────────────
  {
    id: 'briefs-what',
    roles: ['institution_staff'],
    question: 'What are Briefs?',
    keywords: ['brief', 'briefs', 'assignment', 'task'],
    answer: 'A Brief is structured work you set for students — something like a business plan or a social media campaign — with criteria you write once that every submission gets checked against. Work students already did outside LERN can also be uploaded as a Brief, so it goes through the same review and still counts as verified, not just taken on trust.',
  },
  {
    id: 'briefs-create',
    roles: ['institution_staff'],
    question: 'How do I create a brief?',
    keywords: ['create brief', 'new brief', 'set a brief'],
    answer: 'On Briefs, tap "Create" in the top right, fill in the title, topic, criteria and a deadline, and assign it to a group. It appears on Briefs with a status pill — New, In progress, or Verified — that updates as students submit and you review their work.',
  },
  {
    id: 'briefs-upload-existing',
    roles: ['institution_staff'],
    question: 'How do I upload work students already do?',
    keywords: ['upload existing work', 'work already do', 'already do', 'existing work'],
    answer: 'On Briefs, switch to the "Upload work students already do" tab. This is for work that happened outside LERN — you write the criteria it should be checked against, attach the work, and choose the group. It\'s created as a real Brief, so it still goes through Review before it counts as verified; it is never auto-verified just because it already happened.',
  },
  {
    id: 'briefs-revoke',
    roles: ['institution_staff'],
    question: 'How do I revoke a brief?',
    keywords: ['revoke brief', 'close brief', 'end brief'],
    answer: 'Open the brief and choose "Revoke". That closes it to new submissions — work already verified under it stays verified, it just stops accepting anything new.',
  },
  {
    id: 'courses-what',
    roles: ['provider_staff'],
    question: 'What are Courses?',
    keywords: ['course', 'courses', 'cohort programme'],
    answer: 'A Course is a cohort-based programme you run, with a due date and sessions. Assign it to a group and it automatically becomes a trackable cohort in Bootcamp Evidence — nothing extra to set up there.',
  },
  {
    id: 'courses-create',
    roles: ['provider_staff'],
    question: 'How do I create a course?',
    keywords: ['create course', 'new course', 'set up course'],
    answer: 'On Courses, tap "Create", fill in the title, topic and dates, and assign it to a group. It behaves like a Brief underneath — submissions, review, verification — but is labelled as a Course throughout.',
  },

  // ── Workshops ────────────────────────────────────────────────────
  {
    id: 'workshops-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What are Workshops?',
    keywords: ['workshop', 'workshops', 'live session'],
    answer: 'Workshops are live sessions students or learners join straight from their own dashboard — online with video, or in person with just a location. No separate video tool or extra login to manage; it all runs inside LERN.',
  },
  {
    id: 'workshops-start',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I start a live workshop?',
    keywords: ['start workshop', 'join workshop', 'begin session'],
    answer: 'Open the workshop and tap "Start session". Everyone who\'s been invited can join from their own dashboard the moment it starts — recording is compulsory for every live session and starts automatically, so there\'s nothing extra to turn on.',
  },
  {
    id: 'workshops-recording',
    roles: ['institution_staff', 'provider_staff'],
    question: 'Where do I find a workshop recording?',
    keywords: ['workshop recording', 'download recording', 'past workshop'],
    answer: 'After a session ends, its recording appears on the workshop\'s own page. There\'s a download button there — if it doesn\'t start a download, try a different browser.',
  },

  // ── Interest received ────────────────────────────────────────────
  {
    id: 'interest-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What is Interest received?',
    keywords: ['interest received', 'employer interest', 'employer request'],
    answer: "Interest received is where an employer's interest in one of your students lands first — always with a member of staff, never straight to the student. You reply on the student's behalf, and your safeguarding lead can see the whole thread.",
  },
  {
    id: 'interest-reply',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I reply to an employer?',
    keywords: ['reply to employer', 'respond interest', 'message employer'],
    answer: 'Open the request on Interest received and reply from the thread at the bottom. Sending a reply also accepts the request if it was still pending. Never share a student\'s personal contact details in the thread — everything should stay routed through LERN.',
  },
  {
    id: 'interest-decline',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I decline an employer request?',
    keywords: ['decline request', 'reject employer', 'turn down interest'],
    answer: 'Open the request and tap "Decline" near the top of the thread. The employer is told it was declined; no further contact happens through that request.',
  },

  // ── Job tracking ─────────────────────────────────────────────────
  {
    id: 'jobtracking-what',
    roles: ['institution_staff', 'provider_staff'],
    question: 'What is Job tracking?',
    keywords: ['job tracking', 'applications', 'application stage'],
    answer: "Job tracking follows every live opportunity your students or learners have applied to, and where each one stands — applied, reviewing, shortlisted, interview, or offer — so you can see at a glance who's in interview and who might need a nudge.",
  },

  // ── Dashboard ────────────────────────────────────────────────────
  {
    id: 'dashboard-what-inst',
    roles: ['institution_staff'],
    question: 'What is the Dashboard?',
    keywords: ['dashboard', 'summary', 'overview'],
    answer: "The Dashboard is the summary view for whoever's running safeguarding or admin: students, active briefs, work awaiting review, verified work, and a \"Needs attention\" list of anything overdue, so nothing slips through.",
  },
  {
    id: 'dashboard-what-prov',
    roles: ['provider_staff'],
    question: 'What is the Dashboard?',
    keywords: ['dashboard', 'summary', 'overview'],
    answer: "The Dashboard is your organisation's summary: learners, courses, work awaiting review, verified work, recent activity, and how much has been verified this week.",
  },
  {
    id: 'dashboard-what-emp',
    roles: ['employer'],
    question: 'What is the Dashboard?',
    keywords: ['dashboard', 'summary', 'overview'],
    answer: "The Dashboard shows this month's hires, how many people are in your pipeline, and how many young people you've reached — plus pipeline-by-status and which partner organisations are sending you the most candidates.",
  },

  // ── Settings / account (shared) ──────────────────────────────────
  {
    id: 'settings-theme',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'How do I change light or dark mode?',
    keywords: ['dark mode', 'light mode', 'theme', 'appearance'],
    answer: 'Open Settings and go to Appearance. You can pick light, dark, or "match my device", and it applies straight away.',
  },
  {
    id: 'settings-password',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'How do I change my password?',
    keywords: ['change password', 'reset password', 'new password'],
    answer: 'Settings → Security has a "Change password" option. You\'ll need your current password to set a new one; if you\'ve forgotten it entirely, use "Forgot password" on the login page instead.',
  },
  {
    id: 'settings-2fa',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'How do I set up two-step verification?',
    keywords: ['two-step', 'two factor', '2fa', 'mfa', 'authenticator'],
    answer: 'Settings → Security has a "Two-step verification" option. Turning it on asks for a code from an authenticator app each time you sign in from a new device, and gives you a set of one-time recovery codes — save those somewhere safe in case you lose access to the app.',
  },
  {
    id: 'settings-safeguarding-lead',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I set the safeguarding lead?',
    keywords: ['safeguarding lead', 'designate lead', 'change lead'],
    answer: "Your organisation's safeguarding lead is set in Settings. They're the one who sees routed employer interest and safeguarding alerts, so this should be whoever is genuinely responsible for that at your organisation.",
  },
  {
    id: 'settings-billing',
    roles: ['institution_staff', 'provider_staff'],
    question: 'How do I see or change billing?',
    keywords: ['billing', 'subscription', 'invoice', 'price', 'plan'],
    answer: "Your organisation's billing is on the Dashboard, or under Settings → Billing. Pricing for institutions and training providers is set in your service agreement, not a self-serve plan picker — contact LERN directly for anything about it.",
  },
  {
    id: 'settings-export-data',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'How do I export my data?',
    keywords: ['export my data', 'download my data', 'gdpr', 'data request'],
    answer: 'Settings → Privacy & data has an "Export my data" button, which downloads everything LERN holds on your account as a file. If it doesn\'t start a download, try a different browser — some block it by default.',
  },
  {
    id: 'settings-delete-account',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'How do I delete my account?',
    keywords: ['delete account', 'close account', 'remove account'],
    answer: 'Settings → Privacy & data has "Delete my account and data". It asks you to confirm since it can\'t be undone — everything tied to your account is permanently removed.',
  },

  // ── Employer-specific ────────────────────────────────────────────
  {
    id: 'discover-what',
    roles: ['employer'],
    question: 'What is Discover?',
    keywords: ['discover', 'browse', 'verified work'],
    answer: "Discover is where you browse verified briefs and course work from schools and providers — every piece marked \"Verified by a reviewer\", so nothing you see is just a student's own claim. Under-18s are never publicly searchable as people; expressing interest always routes through the student's school or provider first.",
  },
  {
    id: 'discover-express-interest',
    roles: ['employer'],
    question: 'How do I express interest in a student?',
    keywords: ['express interest', 'contact student', 'interested in student'],
    answer: 'On a piece of work in Discover, tap "Express interest". It goes to the student\'s school or training provider first, never to the student directly — they\'ll reply on the student\'s behalf through Inbox.',
  },
  {
    id: 'talentpools-what',
    roles: ['employer'],
    question: 'What are Talent pools?',
    keywords: ['talent pool', 'talent pools', 'shortlist', 'saved candidates'],
    answer: "A Talent pool is a saved shortlist that LERN keeps warm automatically — a profile prompt, a workshop invite, a check-in, sent on a schedule with no ongoing effort from you. It's how you hire five out of ten candidates today and keep the other five genuinely in touch, not forgotten.",
  },
  {
    id: 'talentpools-create',
    roles: ['employer'],
    question: 'How do I create a talent pool?',
    keywords: ['create talent pool', 'new pool', 'add to pool'],
    answer: 'On Talent pools, tap "New pool", name it, and add candidates to it from Discover or Candidates. The automatic cadence of check-ins starts as soon as someone\'s added.',
  },
  {
    id: 'jobs-post',
    roles: ['employer'],
    question: 'How do I post a job?',
    keywords: ['post a job', 'new job', 'vacancy', 'internship'],
    answer: 'On Jobs, tap "Post a job". Fill in the role, type (internship, work experience, apprenticeship), and description. Responses come in through Candidates, in the same pipeline as everything else.',
  },
  {
    id: 'candidates-pipeline',
    roles: ['employer'],
    question: 'How does the candidate pipeline work?',
    keywords: ['candidate pipeline', 'applied', 'shortlisted', 'hired'],
    answer: 'Every candidate moves through the same stages — Applied, Reviewing, Shortlisted, Interview, Offer, Hired — visible on Candidates without needing a separate spreadsheet. Move someone by opening their card and changing their stage.',
  },
  {
    id: 'inbox-what',
    roles: ['employer'],
    question: 'What is Inbox?',
    keywords: ['inbox', 'messages', 'conversations'],
    answer: 'Inbox holds every conversation about a candidate in one place — but always through their school or training provider, never a direct line to a young person.',
  },
  {
    id: 'partners-what',
    roles: ['employer'],
    question: 'What is Partners?',
    keywords: ['partners', 'partner organisations', 'schools'],
    answer: "Partners lists the schools, colleges and training providers you work with, and how many young people each has reached through you — useful for seeing where your relationships are strongest.",
  },
  {
    id: 'employer-billing',
    roles: ['employer'],
    question: 'How do I manage my subscription or plan?',
    keywords: ['employer billing', 'subscription', 'change plan', 'upgrade', 'cancel subscription'],
    answer: 'Settings → Subscription shows your current plan and usage. You can change plan or cancel from there — cancelling stops the next renewal, but you keep access until the end of the period you\'ve already paid for. There\'s no refund for the current period once it\'s started, except if LERN was at fault.',
  },
  {
    id: 'employer-why-no-direct-contact',
    roles: ['employer'],
    question: "Why can't I contact a student directly?",
    keywords: ['direct contact', 'contact student', 'why no contact', 'message student directly'],
    answer: "Under-18s are never directly contactable on LERN, by design — every message to or from a young person routes through their school or training provider. It's the one rule the whole safeguarding model is built on, and it doesn't have an exception.",
  },

  // ── General / fallback-adjacent ──────────────────────────────────
  {
    id: 'general-who-sees-data',
    roles: ['institution_staff', 'provider_staff', 'employer'],
    question: 'Who can see a student under 18?',
    keywords: ['under 18', 'privacy', 'who can see', 'visibility'],
    answer: "An under-18's profile is never publicly searchable, and no one outside their own organisation can contact them directly. Staff at their own school or provider can see their full profile; an employer only ever sees verified work, routed through staff."
  },
]
