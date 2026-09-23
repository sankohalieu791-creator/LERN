import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cadenceForPool, dueStages } from '@/lib/cadence'
import { sendCadenceStage } from '@/lib/server/cadenceSend'

// Talent Pools' automatic weekly cadence -- Final Build Spec, 23 Sep
// 2026: "A fully automatic weekly cadence keeps the candidate warm...
// The system sends every step itself, on a schedule, with no manual
// trigger required." Vercel Cron hits this daily (see vercel.json);
// daily polling is enough resolution for a weekly cadence and stays
// inside the Hobby-plan cron allowance. Idempotent -- safe to run more
// than once, or to have missed a day, since each stage can only ever
// log once per member (see sendCadenceStage's insert-first guard).
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: openPools, error: poolsError } = await admin
    .from('talent_pools')
    .select('id, employer_id, custom_cadence')
    .is('role_filled_at', null)
  if (poolsError) return NextResponse.json({ error: poolsError.message }, { status: 500 })
  if (!openPools || openPools.length === 0) return NextResponse.json({ processed: 0, sent: 0 })

  const poolById = new Map(openPools.map(p => [p.id, p]))
  const { data: members, error: membersError } = await admin
    .from('talent_pool_members')
    .select('id, pool_id, student_id, created_at')
    .in('pool_id', openPools.map(p => p.id))
  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })
  if (!members || members.length === 0) return NextResponse.json({ processed: 0, sent: 0 })

  const { data: sends } = await admin
    .from('talent_pool_cadence_sends')
    .select('member_id, stage')
    .in('member_id', members.map(m => m.id))
  const sentByMember = new Map<string, number[]>()
  for (const s of sends || []) sentByMember.set(s.member_id, [...(sentByMember.get(s.member_id) || []), s.stage])

  let sentCount = 0
  const errors: string[] = []
  for (const member of members) {
    const pool = poolById.get(member.pool_id)
    if (!pool) continue
    const cadence = cadenceForPool(pool.custom_cadence)
    const daysSinceAdded = Math.floor((Date.now() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24))
    const sentStages = sentByMember.get(member.id) || []
    const due = dueStages(cadence, daysSinceAdded, sentStages)
    for (const step of due) {
      const result = await sendCadenceStage(admin, {
        memberId: member.id, employerId: pool.employer_id, studentId: member.student_id,
        stage: step.stage, label: step.label, message: step.message,
      })
      if (result.error) errors.push(result.error)
      else if (result.sent) sentCount++
    }
  }

  return NextResponse.json({ processed: members.length, sent: sentCount, errors: errors.slice(0, 10) })
}
