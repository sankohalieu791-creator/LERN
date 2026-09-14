import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Urgent fix: claimGuestInvite() sends a Supabase magic link with
// { role: 'employer', guest_invite_id } in the sign-up metadata -- but
// that metadata only ever gets applied by handle_new_user() when the
// auth user is genuinely NEW. If the email typed on the claim page
// already belongs to an existing LERN account (any role), the magic
// link just signs that person into their REAL, existing account —
// guest scoping never even enters the picture, and /guest/confirm's
// unconditional router.replace('/employer') then gets silently
// overridden by RoleGate back to whatever that account's real role
// is. That's exactly the bug reported: "I keep seeing the student
// layout, their account, everything inside" after claiming with an
// email that turned out to already be registered. This check runs
// BEFORE the magic link is ever sent, so the claim is refused outright
// instead of quietly logging someone into the wrong account.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (!email?.trim()) return NextResponse.json({ error: 'Email required.' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('users').select('id').ilike('email', email.trim()).maybeSingle()

  return NextResponse.json({ exists: !!data })
}
