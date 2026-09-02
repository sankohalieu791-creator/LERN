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

// Keep in sync with the founder-allowlist test accounts — these already
// have real seeded courses/workshops/briefs/posts behind them from
// earlier build passes.
const PERSONA_EMAIL: Record<Role, string> = {
  student: 'sankohalieu791@gmail.com',
  institution_staff: 'alieu@joinirl.co.uk',
  provider_staff: 'mohalieu58@gmail.com',
  employer: 'sankohaugusta9@gmail.com',
}

export async function POST(req: NextRequest) {
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

  const targetEmail = PERSONA_EMAIL[role as Role]
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: targetEmail })
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Could not switch roles.' }, { status: 500 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token, email: targetEmail })
}
