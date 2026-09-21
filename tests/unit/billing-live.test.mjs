import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('C:/dev/LERN-App/lern/.env.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anonUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let failures = 0
function eq(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : '*** FAIL ***'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}

const staffEmail = `billing-test-staff-${Date.now()}@lerntest.alieu.co.uk`
const { data: staffAuth } = await admin.auth.admin.createUser({ email: staffEmail, password: 'TestPassword123!', email_confirm: true })
const { data: org } = await admin.from('organisations').insert([{ name: 'Billing Test Provider', type: 'provider' }]).select().single()
await admin.from('users').update({ role: 'provider_staff', organisation_id: org.id, consented_at: new Date().toISOString() }).eq('id', staffAuth.user.id)

const anonStaff = createClient(anonUrl, anonKey)
const { data: staffSession } = await anonStaff.auth.signInWithPassword({ email: staffEmail, password: 'TestPassword123!' })
const asStaff = createClient(anonUrl, anonKey, { global: { headers: { Authorization: `Bearer ${staffSession.session.access_token}` } } })

async function addLoggedInStudents(n) {
  const ids = []
  for (let i = 0; i < n; i++) {
    const email = `billing-student-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}@lerntest.alieu.co.uk`
    let data, error
    for (let attempt = 0; attempt < 5; attempt++) {
      ;({ data, error } = await admin.auth.admin.createUser({ email, password: 'TestPassword123!', email_confirm: true }))
      if (data?.user) break
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
    if (!data?.user) throw new Error('createUser failed repeatedly: ' + error?.message)
    await admin.from('users').update({ role: 'student', organisation_id: org.id }).eq('id', data.user.id)
    ids.push(data.user.id)
  }
  return ids
}
async function markLoggedIn(ids) {
  if (!ids.length) return
  await admin.rpc('_test_mark_logged_in', { p_ids: ids })
}

// ── Never-logged-in accounts don't count. ──
const neverLoggedIn = await addLoggedInStudents(10)
let billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('10 never-logged-in students -> headcount 0', billing.headcount, 0)
eq('first-ever sync at headcount 0 -> base price locked at 0', billing.base_annual_price, 0)
eq('first-ever sync -> no adjustments (fresh baseline, not a change)', billing.adjustments.length, 0)

// ── Explicit decision (confirmed with the user): growth WITHIN the same
// band does NOT bill mid-cycle, only a genuine band CROSSING does.
// Log in 80 of them -- still well within the "1-99" band as the 10
// never-logged-in ones were (band unchanged), so base price should
// stay locked at the ORIGINAL 0, not jump to a freshly-computed 5600. ──
await markLoggedIn(neverLoggedIn)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('headcount now 10 (only these 10 logged in)', billing.headcount, 10)
eq('still band 1-99 (same as locked) -> base price UNCHANGED at 0', billing.base_annual_price, 0)
eq('still no adjustments -- within-band growth is not billed mid-cycle', billing.adjustments.length, 0)

// ── Now actually CROSS a band boundary: 1-99 -> 100-299. ──
const moreIds = await addLoggedInStudents(95) // 10 + 95 = 105, crosses into 100-299
await markLoggedIn(moreIds)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('headcount now 105', billing.headcount, 105)
eq('crossed into 100-299 -> base price updates to the flat 6500', billing.base_annual_price, 6500)
eq('exactly one adjustment logged for the crossing', billing.adjustments.length, 1)
console.log('  adjustment:', billing.adjustments[0], '(amount = (6500-0)/12*12 = 6500, since this is still month 1 of the cycle)')
eq('adjustment amount matches (6500-0)/12*12', billing.adjustments[0]?.amount, 6500)

// ── Re-sync with no further change: must not duplicate. ──
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('re-sync, same band, no change -> still exactly one adjustment', billing.adjustments.length, 1)

// ── Growth WITHIN the new 100-299 band (still flat 6500) -> no new adjustment. ──
const withinBandIds = await addLoggedInStudents(50) // 105+50=155, still 100-299
await markLoggedIn(withinBandIds)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('headcount now 155, still 100-299 band', billing.headcount, 155)
eq('same band -> base price still 6500, no new adjustment', billing.adjustments.length, 1)

// ── Bootcamp Evidence toggle. ──
let err = (await asStaff.rpc('set_bootcamp_evidence', { p_org_id: org.id, p_enabled: true })).error
eq('enable bootcamp evidence: no error', err, null)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('bootcamp evidence annual = 1800', billing.bootcamp_evidence_annual, 1800)
eq('total = 6500 + 6500(adj) + 1800', billing.total, 6500 + 6500 + 1800)

err = (await asStaff.rpc('set_bootcamp_evidence', { p_org_id: org.id, p_enabled: false })).error
eq('disable bootcamp evidence: no error', err, null)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('bootcamp evidence annual back to 0', billing.bootcamp_evidence_annual, 0)

// ── Simulate a full year passing: new cycle resets adjustments + rebases the locked price to whatever's live now. ──
await admin.from('organisations').update({ billing_cycle_start: '2020-01-01' }).eq('id', org.id)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
eq('after simulated year rollover: adjustments reset to none', billing.adjustments.length, 0)
eq('base price re-locked at current live price (155 -> still 6500)', billing.base_annual_price, 6500)

// ── A DROP in headcount/band mid-cycle must never create a rebate. ──
for (const id of [...moreIds, ...withinBandIds].slice(0, 100)) await admin.auth.admin.deleteUser(id)
billing = (await asStaff.rpc('get_org_billing', { p_org_id: org.id })).data
console.log('  headcount after big removal:', billing.headcount)
eq('dropped back toward 1-99 band -> base price UNCHANGED (no rebate)', billing.base_annual_price, 6500)
eq('drop -> no new adjustment either', billing.adjustments.length, 0)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)

await admin.auth.admin.deleteUser(staffAuth.user.id)
for (const id of [...neverLoggedIn, ...moreIds, ...withinBandIds]) await admin.auth.admin.deleteUser(id).catch(() => {})
await admin.from('organisations').delete().eq('id', org.id)
console.log('cleaned up')
process.exit(failures === 0 ? 0 : 1)
