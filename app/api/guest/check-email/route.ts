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
// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
//
// createSupabaseAdmin() is a plain (non-generic) function wrapping the
// actual createClient(url, key) call -- ReturnType<typeof createClient>
// directly on the generic createClient would resolve its Database type
// parameter with no call-site context, which silently widened every
// .update()/.insert() argument below to `never`. Wrapping it in an
// ordinary function first gives TypeScript a concrete call to infer
// from, exactly like the original eager `const getSupabaseAdmin() =
// createClient(...)` did.
function createSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Not configured yet.')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
let _supabaseAdmin: ReturnType<typeof createSupabaseAdmin> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdmin()
  return _supabaseAdmin
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (!email?.trim()) return NextResponse.json({ error: 'Email required.' }, { status: 400 })

  const { data } = await getSupabaseAdmin()
    .from('users').select('id').ilike('email', email.trim()).maybeSingle()

  return NextResponse.json({ exists: !!data })
}
