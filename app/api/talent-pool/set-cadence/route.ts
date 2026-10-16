import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { CadenceStep } from '@/lib/cadence'

// "Scale and Enterprise additionally get a customisable cadence...
// Micro and Growth get the fixed default cadence." Re-checked here
// against the employer's real tier, not just trusted from the client --
// the same posture as isDowngradeBlocked's own server-side re-check.
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

function validCadence(cadence: unknown): cadence is CadenceStep[] {
  return Array.isArray(cadence) && cadence.length > 0 && cadence.every(s =>
    s && typeof s.day === 'number' && s.day > 0 && typeof s.label === 'string' && s.label.trim() && typeof s.message === 'string' && s.message.trim()
  )
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await getSupabaseAdmin().auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { poolId, cadence } = await req.json().catch(() => ({}))
  if (!poolId) return NextResponse.json({ error: 'Missing poolId.' }, { status: 400 })
  if (cadence !== null && !validCadence(cadence)) return NextResponse.json({ error: 'Each step needs a day, a label, and a message.' }, { status: 400 })

  const { data: profile } = await getSupabaseAdmin().from('users').select('id, role, employer_tier').eq('id', callerData.user.id).single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })
  if (cadence !== null && profile.employer_tier !== 'scale' && profile.employer_tier !== 'enterprise') {
    return NextResponse.json({ error: 'A customisable cadence is a Scale or Enterprise feature — upgrade to edit it.' }, { status: 403 })
  }

  const { data: pool } = await getSupabaseAdmin().from('talent_pools').select('id, employer_id').eq('id', poolId).single()
  if (!pool || pool.employer_id !== callerData.user.id) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })

  const { error } = await getSupabaseAdmin().from('talent_pools').update({ custom_cadence: cadence }).eq('id', poolId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
