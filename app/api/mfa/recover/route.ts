import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Backup-code recovery for two-step verification. A plain code check
// can't elevate the real session AAL the way supabase.auth.mfa.verify()
// does -- that's an Auth-service-level thing, not something a SQL
// function can fake -- so instead of pretending to satisfy the second
// factor, this deletes the lost TOTP factor server-side (the admin API
// is the only thing that can) once the code checks out. After that,
// getAuthenticatorAssuranceLevel() genuinely reports no challenge is
// needed, because there genuinely isn't a factor left to challenge.
// Same shape as GitHub/Google's own recovery codes: using one gets you
// back in, but resets 2FA rather than quietly bypassing it, so the
// account isn't left protected by a single code that could be reused
// or intercepted.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { code } = await req.json().catch(() => ({}))
  if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Enter a recovery code.' }, { status: 400 })

  // Verified as the actual caller (not service role) so auth.uid()
  // resolves inside the RPC -- this only ever checks/consumes a code
  // for the account the just-verified bearer token belongs to.
  const asUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  )
  const { data: valid, error: rpcError } = await asUser.rpc('verify_and_consume_recovery_code', { p_code: code })
  if (rpcError) return NextResponse.json({ error: 'Could not verify that code.' }, { status: 500 })
  if (!valid) return NextResponse.json({ error: 'That recovery code is invalid or has already been used.' }, { status: 400 })

  const { data: factors, error: listError } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: callerData.user.id })
  if (listError) return NextResponse.json({ error: 'Recovery code accepted, but could not reset your 2FA — contact support.' }, { status: 500 })
  for (const factor of factors?.factors || []) {
    await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: callerData.user.id })
  }
  await supabaseAdmin.from('users').update({ two_step_enabled: false }).eq('id', callerData.user.id)

  return NextResponse.json({ ok: true })
}
