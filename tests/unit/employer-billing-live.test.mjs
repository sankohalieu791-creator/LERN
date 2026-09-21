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

const email = `billing-test-employer-${Date.now()}@lerntest.alieu.co.uk`
const { data: created } = await admin.auth.admin.createUser({ email, password: 'TestPassword123!', email_confirm: true, user_metadata: { role: 'employer' } })
await admin.from('users').update({ consented_at: new Date().toISOString(), employer_verified: true }).eq('id', created.user.id)

const anon = createClient(anonUrl, anonKey)
const { data: session } = await anon.auth.signInWithPassword({ email, password: 'TestPassword123!' })
const asEmployer = createClient(anonUrl, anonKey, { global: { headers: { Authorization: `Bearer ${session.session.access_token}` } } })

// 1. Set an initial tier.
let { error } = await asEmployer.rpc('set_employer_tier', { p_employer_id: created.user.id, p_tier: 'growth' })
eq('set tier to growth: no error', error, null)
let billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('tier is growth', billing.tier, 'growth')
eq('subscription status active', billing.subscription_status, 'active')
eq('0 talent pools used', billing.talent_pools_used, 0)

// 2. Create 22 talent pools (over Growth's limit of 20, but Growth ITSELF allows exactly 20 -- create 25 to test downgrade blocking against Micro's limit of 5, and also verify Growth's own limit would block a same-tier re-set if exceeded... spec only requires blocking a DOWNGRADE, so test that specifically).
for (let i = 0; i < 22; i++) {
  await admin.from('talent_pools').insert([{ employer_id: created.user.id, name: `Pool ${i}` }])
}
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('22 talent pools used', billing.talent_pools_used, 22)

// 3. Try downgrading to Micro (limit 5) -- should be blocked.
;({ error } = await asEmployer.rpc('set_employer_tier', { p_employer_id: created.user.id, p_tier: 'micro' }))
console.log('  downgrade-to-micro error (expected):', error?.message)
eq('downgrade to micro blocked while 22 pools exist', !!error, true)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('tier is still growth after blocked downgrade attempt', billing.tier, 'growth')

// 4. Upgrading to Scale (limit 35) should succeed even with 22 pools.
;({ error } = await asEmployer.rpc('set_employer_tier', { p_employer_id: created.user.id, p_tier: 'scale' }))
eq('upgrade to scale with 22 pools: succeeds', error, null)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('tier is now scale', billing.tier, 'scale')

// 5. Remove pools down to 3, then downgrade to Micro should now succeed.
const { data: pools } = await admin.from('talent_pools').select('id').eq('employer_id', created.user.id)
for (const p of pools.slice(0, 19)) await admin.from('talent_pools').delete().eq('id', p.id)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('down to 3 talent pools', billing.talent_pools_used, 3)
;({ error } = await asEmployer.rpc('set_employer_tier', { p_employer_id: created.user.id, p_tier: 'micro' }))
eq('downgrade to micro now succeeds (3 pools <= limit 5)', error, null)

// 6. Cancellation flow: cancel now, verify status + period end, then
//    simulate the period having already ended and confirm the lazy
//    flip to 'restricted', and that it then genuinely blocks a real
//    RLS-gated write (creating a new talent pool).
;({ error } = await asEmployer.rpc('cancel_employer_subscription', { p_employer_id: created.user.id }))
eq('cancel subscription: no error', error, null)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('status is canceled', billing.subscription_status, 'canceled')
eq('period end is set (truthy)', !!billing.subscription_period_end, true)

// Access should still work DURING the notice period.
const { error: stillWorksErr } = await asEmployer.from('talent_pools').insert([{ employer_id: created.user.id, name: 'Still active' }])
eq('can still create a talent pool during the notice period', stillWorksErr, null)

// Fast-forward the period end into the past.
await admin.from('users').update({ employer_subscription_period_end: new Date(Date.now() - 60000).toISOString() }).eq('id', created.user.id)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('after period end has passed: status flips to restricted', billing.subscription_status, 'restricted')

const { error: blockedErr } = await asEmployer.from('talent_pools').insert([{ employer_id: created.user.id, name: 'Should be blocked' }])
console.log('  restricted-account insert error (expected):', blockedErr?.message)
eq('restricted account cannot create a new talent pool', !!blockedErr, true)

// 7. Resubscribing (picking a tier again) should reactivate.
;({ error } = await asEmployer.rpc('set_employer_tier', { p_employer_id: created.user.id, p_tier: 'micro' }))
eq('resubscribing: no error', error, null)
billing = (await asEmployer.rpc('get_employer_billing', { p_employer_id: created.user.id })).data
eq('status back to active after resubscribing', billing.subscription_status, 'active')
const { error: worksAgainErr } = await asEmployer.from('talent_pools').insert([{ employer_id: created.user.id, name: 'Active again' }])
eq('can create a talent pool again after reactivating', worksAgainErr, null)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
await admin.auth.admin.deleteUser(created.user.id)
console.log('cleaned up')
process.exit(failures === 0 ? 0 : 1)
