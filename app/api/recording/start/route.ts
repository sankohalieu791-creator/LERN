import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Starts Agora Cloud Recording for a session. Needs Agora Cloud Recording
// credentials (separate from the RTC App ID/Certificate) + an S3 bucket
// Agora uploads to directly — see 2026-08-28-session-recording.sql for
// exactly what to add and where. Until both are set, this responds
// clearly with "not set up yet" instead of a confusing failure.
const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? ''
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET
const S3_BUCKET = process.env.AGORA_RECORDING_S3_BUCKET
const S3_REGION = process.env.AGORA_RECORDING_S3_REGION
const S3_ACCESS_KEY = process.env.AGORA_RECORDING_S3_ACCESS_KEY
const S3_SECRET_KEY = process.env.AGORA_RECORDING_S3_SECRET_KEY

const RECORDING_UID = '1' // fixed "bot" uid, unique per-channel namespace only — safe to reuse across workshops

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function agoraAuthHeader() {
  return 'Basic ' + Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString('base64')
}

export async function POST(req: NextRequest) {
  const { workItemId, userId } = await req.json().catch(() => ({}))
  if (!workItemId || !userId) return NextResponse.json({ error: 'workItemId and userId required' }, { status: 400 })

  if (!CUSTOMER_ID || !CUSTOMER_SECRET || !S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    return NextResponse.json({ error: 'not_configured', message: "Recording isn't set up yet — see 2026-08-28-session-recording.sql for what's needed." }, { status: 501 })
  }

  const channelName = `workshop-${workItemId}`

  try {
    let token: string | null = null
    if (APP_CERTIFICATE) {
      const { RtcTokenBuilder, RtcRole } = await import('agora-access-token')
      const expireTs = Math.floor(Date.now() / 1000) + 4 * 3600
      token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, Number(RECORDING_UID), RtcRole.PUBLISHER, expireTs)
    }

    const acquireRes = await fetch(`https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`, {
      method: 'POST',
      headers: { Authorization: agoraAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cname: channelName, uid: RECORDING_UID, clientRequest: { resourceExpiredHour: 24, scene: 0 } }),
    })
    const acquireData = await acquireRes.json()
    if (!acquireRes.ok || !acquireData.resourceId) {
      return NextResponse.json({ error: 'acquire_failed', detail: acquireData }, { status: 502 })
    }

    const startRes = await fetch(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${acquireData.resourceId}/mode/mix/start`,
      {
        method: 'POST',
        headers: { Authorization: agoraAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cname: channelName,
          uid: RECORDING_UID,
          clientRequest: {
            token: token || undefined,
            recordingConfig: { channelType: 1, streamTypes: 2, videoStreamType: 0, maxIdleTime: 300, transcodingConfig: { width: 1280, height: 720, fps: 15, bitrate: 1130 } },
            storageConfig: {
              vendor: 1, // AWS S3
              region: s3RegionCode(S3_REGION),
              bucket: S3_BUCKET,
              accessKey: S3_ACCESS_KEY,
              secretKey: S3_SECRET_KEY,
              fileNamePrefix: ['lern-recordings', workItemId],
            },
          },
        }),
      }
    )
    const startData = await startRes.json()
    if (!startRes.ok || !startData.sid) {
      return NextResponse.json({ error: 'start_failed', detail: startData }, { status: 502 })
    }

    const { data: recording, error } = await supabaseAdmin
      .from('work_item_recordings')
      .insert([{ work_item_id: workItemId, resource_id: acquireData.resourceId, sid: startData.sid, started_by: userId }])
      .select()
      .single()
    if (error) return NextResponse.json({ error: 'db_insert_failed', detail: error.message }, { status: 500 })

    return NextResponse.json({ recordingId: recording.id })
  } catch (err: any) {
    console.error('[recording/start] error:', err)
    return NextResponse.json({ error: 'unexpected', message: err?.message }, { status: 500 })
  }
}

// Agora's numeric region codes for the "vendor: 1" (AWS S3) storage config.
function s3RegionCode(region: string): number {
  const map: Record<string, number> = {
    'us-east-1': 0, 'us-east-2': 1, 'us-west-1': 2, 'us-west-2': 3,
    'eu-west-1': 4, 'eu-west-2': 12, 'eu-west-3': 13, 'eu-central-1': 5,
    'ap-southeast-1': 6, 'ap-southeast-2': 7, 'ap-northeast-1': 8, 'ap-northeast-2': 18,
    'sa-east-1': 9, 'ap-south-1': 15, 'ca-central-1': 16,
  }
  return map[region] ?? 0
}
