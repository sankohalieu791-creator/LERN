import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET
const RECORDING_UID = '1'

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

function agoraAuthHeader() {
  return 'Basic ' + Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString('base64')
}

export async function POST(req: NextRequest) {
  const { recordingId } = await req.json().catch(() => ({}))
  if (!recordingId) return NextResponse.json({ error: 'recordingId required' }, { status: 400 })

  const { data: recording, error: fetchError } = await getSupabaseAdmin()
    .from('work_item_recordings')
    .select('id, work_item_id, resource_id, sid')
    .eq('id', recordingId)
    .single()
  if (fetchError || !recording) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!CUSTOMER_ID || !CUSTOMER_SECRET) {
    return NextResponse.json({ error: 'not_configured' }, { status: 501 })
  }

  const channelName = `workshop-${recording.work_item_id}`

  try {
    const stopRes = await fetch(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${recording.resource_id}/sid/${recording.sid}/mode/mix/stop`,
      {
        method: 'POST',
        headers: { Authorization: agoraAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cname: channelName, uid: RECORDING_UID, clientRequest: {} }),
      }
    )
    const stopData = await stopRes.json()
    const fileList = stopData?.serverResponse?.fileList ?? null

    await getSupabaseAdmin()
      .from('work_item_recordings')
      .update({ status: fileList ? 'available' : 'stopped', file_list: fileList, stopped_at: new Date().toISOString() })
      .eq('id', recordingId)

    return NextResponse.json({ stopped: true, fileList })
  } catch (err: any) {
    console.error('[recording/stop] error:', err)
    await getSupabaseAdmin().from('work_item_recordings').update({ status: 'failed', stopped_at: new Date().toISOString() }).eq('id', recordingId)
    return NextResponse.json({ error: 'unexpected', message: err?.message }, { status: 500 })
  }
}
