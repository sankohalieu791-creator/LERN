import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      reports(reason)
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

  const copy: Record<string, { subject: string; body: string }> = {
    submission_received: {
      subject: 'New work submitted for review',
      body: `Hi ${first},\n\nA student submitted work${workTitle ? ` for "${workTitle}"` : ''} — it's waiting in your review queue.\n\nReview it: ${APP_URL}`,
    },
    work_verified: {
      subject: 'Your work has been verified',
      body: `Hi ${first},\n\nGreat news — your work${workTitle ? ` for "${workTitle}"` : ''} has been verified. It now shows the green tick on your profile.\n\nSee it: ${APP_URL}`,
    },
    work_returned: {
      subject: 'Your work was returned for revision',
      body: `Hi ${first},\n\nYour work${workTitle ? ` for "${workTitle}"` : ''} was returned with feedback — take a look and resubmit when ready.\n\nSee the feedback: ${APP_URL}`,
    },
    employer_interest: {
      subject: 'An employer has shown interest',
      body: `Hi ${first},\n\nAn employer has expressed interest in one of your students' verified work. This is routed through your organisation first — nothing is shared with the employer or the student directly.\n\nReview it: ${APP_URL}`,
    },
    report: {
      subject: 'A concern has been reported',
      body: `Hi ${first},\n\nSomeone has raised a concern that needs your organisation's attention. It's already been auto-hidden pending review.\n\nReview it: ${APP_URL}`,
    },
    session_started: {
      subject: `The session has started — join now${workTitle ? `: ${workTitle}` : ''}`,
      body: `Hi ${first},\n\n${workTitle ? `"${workTitle}"` : 'Your session'} has started.\n\nJoin now: ${APP_URL}`,
    },
  }

  const { subject, body } = copy[notification.type] || { subject: 'LERN notification', body: `Hi ${first},\n\nYou have a new notification on LERN.\n\n${APP_URL}` }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: recipient.email, subject, text: body }),
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
