import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Role } from '@/lib/types'

// Powers the single public demo login (Lern12@gmail.com / Lerntesterapp) —
// replaces the old hidden "Founder access" + shared-secret dev-login.
// Anyone can sign in with that one credential; this route is what lets
// them then switch into whichever of the 4 real seeded test accounts
// they want to look around as.
//
// Gate: the caller must already hold a real, valid Supabase access token
// for a user flagged is_demo_gateway — that's the whole security model.
// No app-wide secret to leak, no client-supplied email to sign in as
// (the 4 target accounts are a fixed server-side map, not caller input).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Keep in sync with whichever real accounts currently hold each preview
// role -- institution_staff and provider_staff are deliberately absent
// right now. Their old target accounts (alieu@joinirl.co.uk,
// mohalieu58@gmail.com) were freed up in the September demo-data cleanup
// -- alieu@joinirl.co.uk is now an ops_admin login, mohalieu58@gmail.com
// was deleted outright. Leaving stale entries here would have let anyone
// on the public demo gateway "switch" straight into the ops_admin
// account through what looks like an innocuous "School / college" card.
// Add these back only once dedicated preview accounts exist for those
// two roles -- the role-check below is a second line of defence against
// exactly this happening again, but the map staying accurate is the
// actual fix.
const PERSONA_EMAIL: Partial<Record<Role, string>> = {
  student: 'sankohalieu791@gmail.com',
  employer: 'sankohaugusta9@gmail.com',
}

export async function POST(req: NextRequest) {
  // Kill switch, per Michael's Sep-10 review: a single public
  // credential that can switch into the student/safeguarding-lead/
  // provider/verified-employer accounts is fine for an internal demo,
  // but must not exist once a real Leyton student is on the database
  // -- anyone with the shared login could reach a real young person's
  // account. Off unless DEMO_LOGIN_ENABLED is explicitly set to
  // 'true' in the deployment's own env vars, which it is not by
  // default -- flip it on deliberately, per occasion, not left running.
  if (process.env.DEMO_LOGIN_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Demo login is currently disabled.' }, { status: 403 })
  }
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { role } = await req.json().catch(() => ({}))
  if (!role || !(role in PERSONA_EMAIL)) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  // Gate accepts the raw gateway account OR any of the 4 persona
  // accounts themselves -- previously this only accepted
  // is_demo_gateway, which is true for the raw Lern12@gmail.com login
  // but false for every persona it switches you INTO. That meant the
  // very first switch worked, but switching again afterwards (e.g.
  // student -> employer without going back to log out and back in as
  // the gateway account first) was silently rejected with a 403 here,
  // while the client had already navigated to the destination route --
  // RoleGate there then saw the still-unchanged real session and sent
  // it back to wherever THAT role actually belongs. That's "I press
  // Employer and the student layout opens."
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users').select('is_demo_gateway, email').eq('id', callerData.user.id).single()
  const callerIsPersona = profile?.email && Object.values(PERSONA_EMAIL).includes(profile.email)
  if (profileError || !(profile?.is_demo_gateway || callerIsPersona)) {
    return NextResponse.json({ error: 'This account can’t switch roles.' }, { status: 403 })
  }

  // Already checked `role in PERSONA_EMAIL` above, so this is defined.
  const targetEmail = PERSONA_EMAIL[role as Role]!

  // Belt and braces: confirm the target account's role in the database
  // still actually matches what this map claims it is, right before
  // generating a real sign-in link for it. PERSONA_EMAIL going stale
  // (an account it points at gets repurposed or deleted) is exactly how
  // this route once would have handed out an ops_admin session through
  // an "institution_staff" button -- this check makes that fail loudly
  // instead of silently working.
  const { data: targetProfile } = await supabaseAdmin
    .from('users').select('role').eq('email', targetEmail).single()
  if (!targetProfile || targetProfile.role !== role) {
    return NextResponse.json({ error: 'That preview account isn’t set up right now.' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: targetEmail })
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Could not switch roles.' }, { status: 500 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token, email: targetEmail })
}
