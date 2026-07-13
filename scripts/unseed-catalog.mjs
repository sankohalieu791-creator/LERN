/**
 * Removes everything seed-catalog.mjs created, using scripts/.seed-manifest.json.
 * Run from the `lern` directory:  node scripts/unseed-catalog.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

if (!fs.existsSync('scripts/.seed-manifest.json')) {
  console.error('No scripts/.seed-manifest.json found — nothing to undo.')
  process.exit(1)
}
const m = JSON.parse(fs.readFileSync('scripts/.seed-manifest.json', 'utf8'))

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// course_sessions cascade from courses; delete courses + workshops, then the users.
for (const ids of chunk(m.workshops ?? [], 50)) {
  const { error } = await sb.from('workshops').delete().in('id', ids)
  if (error) console.error('workshops:', error.message)
}
console.log(`Deleted ${m.workshops?.length ?? 0} workshops`)

for (const ids of chunk(m.courses ?? [], 50)) {
  const { error } = await sb.from('courses').delete().in('id', ids)
  if (error) console.error('courses:', error.message)
}
console.log(`Deleted ${m.courses?.length ?? 0} courses (sessions cascade)`)

for (const ins of m.instructors ?? []) {
  const { error } = await sb.auth.admin.deleteUser(ins.id)
  if (error) console.error(`user ${ins.email}:`, error.message)
}
console.log(`Deleted ${m.instructors?.length ?? 0} demo instructor accounts`)

fs.renameSync('scripts/.seed-manifest.json', 'scripts/.seed-manifest.undone.json')
console.log('Done.')
