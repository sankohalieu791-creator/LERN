import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderEmailHtml } from '@/lib/email'

// Called by a Postgres trigger (pg_net) the instant a row lands in
// public.notifications — see 2026-08-28-email-notifications.sql. Sends
// the matching email via Resend. Safeguarding rule from the spec: never
// expose another person's contact details or open a direct channel —
// every email below just names what happened and points back into the
// app, nothing more.
const RESEND_API_KEY = process.env.RESEND_API_KEY
const NOTIFY_SECRET = process.env.NOTIFY_WEBHOOK_SECRET
const FROM = 'LERN <notifications@lernapp.uk>'
const APP_URL = 'https://lernapp.uk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Which Settings notification-preference key gates each type. Not every
// type has one (work_returned isn't listed in the spec's own preference
// set) — those always send.
const PREF_KEY: Record<string, string> = {
  submission_received: 'work_submitted',
  work_verified: 'work_verified',
  employer_interest: 'employer_interest',
  report: 'reports',
}

export async function POST(req: NextRequest) {
  if (NOTIFY_SECRET && req.headers.get('x-notify-secret') !== NOTIFY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { notification_id } = await req.json().catch(() => ({}))
  if (!notification_id) return NextResponse.json({ error: 'notification_id required' }, { status: 400 })

  if (!RESEND_API_KEY) {
    // No key configured yet — safe no-op, not an error. See the
    // migration's own comment for what needs adding and where.
    console.log('[notify] RESEND_API_KEY not set, skipping email for', notification_id)
    return NextResponse.json({ skipped: true })
  }

  const { data: notification, error } = await supabaseAdmin
    .from('notifications')
    .select(`
      id, type,
      users!notifications_user_id_fkey(email, full_name, notification_prefs),
      submissions(id, work_items(title)),
      work_items(title),
      reports(reason),
      applications(stage, student:users!applications_student_id_fkey(full_name), opportunity:opportunities(title))
    `)
    .eq('id', notification_id)
    .single()

  if (error || !notification) return NextResponse.json({ error: 'notification not found' }, { status: 404 })

  const recipient = (notification as any).users
  if (!recipient?.email) return NextResponse.json({ skipped: true, reason: 'no recipient email' })

  const prefKey = PREF_KEY[notification.type]
  if (prefKey && recipient.notification_prefs && recipient.notification_prefs[prefKey] === false) {
    return NextResponse.json({ skipped: true, reason: 'opted out' })
  }

  const workTitle = (notification as any).submissions?.work_items?.title || (notification as any).work_items?.title
  const first = recipient.full_name?.split(' ')[0] || 'there'
  const application = (notification as any).applications
  const STAGE_LABEL: Record<string, string> = {
    applied: 'Applied', reviewing: 'Reviewing', shortlisted: 'Shortlisted', interview: 'Interview',
    offer: 'Offer', hired: 'Hired', not_progressing: 'Not progressing',
  }

  const workRef = workTitle ? ` for "${workTitle}"` : ''
  const stage = STAGE_LABEL[application?.stage] || 'a new stage'

  const copy: Record<string, { subject: string; heading: string; paragraphs: string[]; ctaLabel: string }> = {
    submission_received: {
      subject: 'New work submitted for review',
      heading: 'New work is waiting in your review queue',
      paragraphs: [
        `Hi ${first},`,
        `A student on your programme has just submitted new work${workRef}. It's now waiting in your review queue — take a look, leave feedback if anything needs changing, and verify it once it meets the criteria you set.`,
        `The sooner it's reviewed, the sooner it can count toward that student's verified portfolio.`,
      ],
      ctaLabel: 'Review the submission',
    },
    work_verified: {
      subject: 'Your work has been verified',
      heading: 'Your work has just been verified',
      paragraphs: [
        `Hi ${first},`,
        `Great news — your work${workRef} has been checked and verified by your organisation. It now shows the green verified tick on your profile.`,
        `If you've chosen to make it public, employers browsing LERN can see it as real, checked proof of what you can do — exactly the kind of evidence that helps you stand out.`,
      ],
      ctaLabel: 'View your profile',
    },
    work_returned: {
      subject: 'Your work was returned for revision',
      heading: 'Your work was sent back with feedback',
      paragraphs: [
        `Hi ${first},`,
        `Your work${workRef} has been returned by your organisation with some feedback attached, rather than verified as-is. Nothing has been lost — take a look at what they've said, make the changes, and resubmit whenever you're ready.`,
        `This is a completely normal part of getting your best work verified.`,
      ],
      ctaLabel: 'See the feedback',
    },
    employer_interest: {
      subject: 'An employer has shown interest',
      heading: 'An employer would like to know more',
      paragraphs: [
        `Hi ${first},`,
        `An employer has looked at one of your students' verified work and would like to know more. As always on LERN, this is routed through your organisation first — no contact details or personal information have been shared with the employer, and nothing will be, unless you decide to take it further.`,
        `You can read the full message and respond from your dashboard.`,
      ],
      ctaLabel: 'Review the request',
    },
    report: {
      subject: 'A concern has been reported',
      heading: 'A concern needs your attention',
      paragraphs: [
        `Hi ${first},`,
        `Someone has raised a concern about a post on your organisation's feed. It's already been automatically hidden while this is looked into, so no one else can see it right now — but please review it as soon as you reasonably can.`,
      ],
      ctaLabel: 'Review the report',
    },
    session_started: {
      subject: `The session has started — join now${workTitle ? `: ${workTitle}` : ''}`,
      heading: 'Your session has started',
      paragraphs: [
        `Hi ${first},`,
        `${workTitle ? `"${workTitle}"` : 'A live session you are part of'} has just started. Join now to take part — the sooner you join, the more of it you will catch.`,
      ],
      ctaLabel: 'Join the session',
    },
    welcome: {
      subject: 'Thank you for choosing LERN',
      heading: 'Welcome to LERN',
      paragraphs: [
        `Hi ${first},`,
        `Thank you for choosing LERN — your account is now fully set up. LERN exists to turn the real work young people do (placements, projects, courses) into verified evidence they can actually use: on a profile, in applications, and in conversations with employers who are looking for exactly that.`,
        `Take a look at your dashboard to see what's already there for you.`,
      ],
      ctaLabel: 'Go to your dashboard',
    },
    application_stage_changed: {
      subject: `An employer moved a candidate to ${stage}`,
      heading: 'An application has moved forward',
      paragraphs: [
        `Hi ${first},`,
        `${application?.student?.full_name || 'A student'}'s application${application?.opportunity?.title ? ` for "${application.opportunity.title}"` : ''} has just moved to ${stage}.`,
        `It's worth checking in with them directly so they hear it from you before it comes up anywhere else.`,
      ],
      ctaLabel: 'View the pipeline',
    },
  }

  const entry = copy[notification.type] || {
    subject: 'LERN notification', heading: 'You have a new notification',
    paragraphs: [`Hi ${first},`, `You have a new notification waiting for you on LERN.`], ctaLabel: 'Open LERN',
  }
  const { subject, heading, paragraphs, ctaLabel } = entry
  const html = renderEmailHtml({ heading, paragraphs, ctaLabel, ctaUrl: APP_URL })
  // Plain-text alternative for clients that don't render HTML -- kept
  // in sync with the same paragraphs, not a separate, shorter message.
  const text = `${paragraphs.join('\n\n')}\n\n${ctaLabel}: ${APP_URL}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: recipient.email, subject, html, text }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[notify] Resend error:', errText)
      return NextResponse.json({ error: 'send failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[notify] send exception:', err)
    return NextResponse.json({ error: 'send failed' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
