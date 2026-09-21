// Exhaustive boundary tests for lib/billing.ts, run via tsx-less plain
// node against a transpiled copy -- re-implemented inline here 1:1
// with the real file so this can run standalone without a build step.
// (Kept deliberately identical logic; if you change lib/billing.ts,
// change this file to match before trusting these results.)

function employerTierForEmployeeCount(employees) {
  if (employees <= 15) return 'micro'
  if (employees <= 99) return 'growth'
  if (employees <= 499) return 'scale'
  return 'enterprise'
}

function providerBandFor(learners) {
  if (learners <= 99) return '1-99'
  if (learners <= 299) return '100-299'
  if (learners <= 599) return '300-599'
  return '600+'
}
function providerAnnualPrice(learners) {
  const band = providerBandFor(learners)
  if (band === '1-99') return Math.min(learners * 70, 6500)
  if (band === '100-299') return 6500
  if (band === '300-599') return 8500
  return null
}

const INSTITUTION_BASE_PRICE = 2000
const INSTITUTION_BASE_INCLUDED = 750
const INSTITUTION_PER_EXTRA_STUDENT = 2.5
const INSTITUTION_MAX_PRICE = 12000
function institutionAnnualPrice(students) {
  if (students <= INSTITUTION_BASE_INCLUDED) return INSTITUTION_BASE_PRICE
  const extra = students - INSTITUTION_BASE_INCLUDED
  return Math.min(INSTITUTION_BASE_PRICE + extra * INSTITUTION_PER_EXTRA_STUDENT, INSTITUTION_MAX_PRICE)
}

function monthsRemainingInCycle(anchor, now) {
  const anchorDay = anchor.getUTCDate()
  let monthsElapsed = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth())
  if (now.getUTCDate() < anchorDay) monthsElapsed -= 1
  const monthsIntoCurrentCycle = ((monthsElapsed % 12) + 12) % 12
  return 12 - monthsIntoCurrentCycle
}
function prorateBandChange(oldAnnual, newAnnual, monthsRemaining) {
  return Math.round(((newAnnual - oldAnnual) / 12) * monthsRemaining)
}

let failures = 0
function eq(label, actual, expected) {
  const pass = actual === expected
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : '*** FAIL ***'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}

console.log('--- Employer tier boundaries ---')
eq('1 employee', employerTierForEmployeeCount(1), 'micro')
eq('15 employees (top of micro)', employerTierForEmployeeCount(15), 'micro')
eq('16 employees (bottom of growth)', employerTierForEmployeeCount(16), 'growth')
eq('99 employees (top of growth)', employerTierForEmployeeCount(99), 'growth')
eq('100 employees (bottom of scale)', employerTierForEmployeeCount(100), 'scale')
eq('499 employees (top of scale)', employerTierForEmployeeCount(499), 'scale')
eq('500 employees (bottom of enterprise)', employerTierForEmployeeCount(500), 'enterprise')
eq('50000 employees', employerTierForEmployeeCount(50000), 'enterprise')

console.log('\n--- Provider band boundaries + prices ---')
eq('1 learner price', providerAnnualPrice(1), 70)
eq('50 learners price', providerAnnualPrice(50), 3500)
eq('92 learners price (just under cap)', providerAnnualPrice(92), 6440)
eq('93 learners price (cap kicks in, 93*70=6510>6500)', providerAnnualPrice(93), 6500)
eq('99 learners band', providerBandFor(99), '1-99')
eq('99 learners price (capped)', providerAnnualPrice(99), 6500)
eq('100 learners band', providerBandFor(100), '100-299')
eq('100 learners price', providerAnnualPrice(100), 6500)
eq('299 learners band', providerBandFor(299), '100-299')
eq('299 learners price', providerAnnualPrice(299), 6500)
eq('300 learners band', providerBandFor(300), '300-599')
eq('300 learners price', providerAnnualPrice(300), 8500)
eq('599 learners band', providerBandFor(599), '300-599')
eq('599 learners price', providerAnnualPrice(599), 8500)
eq('600 learners band', providerBandFor(600), '600+')
eq('600 learners price (on application)', providerAnnualPrice(600), null)
eq('184 learners price (screenshot case)', providerAnnualPrice(184), 6500)
eq('184 learners band (screenshot case)', providerBandFor(184), '100-299')
eq('312 learners price (screenshot case)', providerAnnualPrice(312), 8500)

console.log('\n--- Institution price boundaries ---')
eq('1 student', institutionAnnualPrice(1), 2000)
eq('750 students (exactly included)', institutionAnnualPrice(750), 2000)
eq('751 students (1 over)', institutionAnnualPrice(751), 2002.5)
eq('1240 students (screenshot case)', institutionAnnualPrice(1240), 2000 + 490 * 2.5)
eq('1240 students = 1225 extra charge', institutionAnnualPrice(1240) - 2000, 1225)
// Cap: base(2000) + (students-750)*2.5 = 12000 => students-750 = 4000 => students = 4750
eq('4750 students (exactly at cap)', institutionAnnualPrice(4750), 12000)
eq('4751 students (1 over cap boundary)', institutionAnnualPrice(4751), 12000)
eq('100000 students (nowhere near, still capped)', institutionAnnualPrice(100000), 12000)

console.log('\n--- Proration: spec\'s own worked example ---')
// "4 whole months left", (8500-6500)/12*4 = 666.67 -> rounds to 667
eq('spec worked example: (8500-6500)/12*4', prorateBandChange(6500, 8500, 4), 667)

console.log('\n--- monthsRemainingInCycle boundaries ---')
// Anchor 15th of the month. "now" also the 15th -> 0 months elapsed this cycle -> 12 remaining.
eq('same day as anchor -> 12 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2025-01-15T00:00:00Z')), 12)
// One day before the monthly anniversary -> that month not yet counted.
eq('1 day before 1-month anniversary -> still 12 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2025-02-14T00:00:00Z')), 12)
// Exactly on the 1-month anniversary -> 1 month elapsed, 11 remaining.
eq('exactly 1 month later -> 11 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2025-02-15T00:00:00Z')), 11)
// 4 months elapsed (spec example context) -> 8 remaining... but spec's OWN example says "4 months remaining", i.e. 8 elapsed.
eq('8 months elapsed -> 4 remaining (spec scenario)', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2025-09-15T00:00:00Z')), 4)
// 11 months elapsed -> 1 remaining
eq('11 months elapsed -> 1 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2025-12-15T00:00:00Z')), 1)
// Exactly 12 months elapsed -> back to 12 remaining (new cycle starts)
eq('exactly 12 months later -> new cycle, 12 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2026-01-15T00:00:00Z')), 12)
// 13 months elapsed -> 11 remaining in the new cycle
eq('13 months elapsed -> 11 remaining', monthsRemainingInCycle(new Date('2025-01-15T00:00:00Z'), new Date('2026-02-15T00:00:00Z')), 11)
// End-of-month anchor edge case (31st, landing in a 30-day or Feb month)
eq('31st anchor, now is 28th Feb (day not reached) -> still previous cycle month', monthsRemainingInCycle(new Date('2025-01-31T00:00:00Z'), new Date('2025-02-28T00:00:00Z')), 12)
eq('31st anchor, now is 1st March (day passed conceptually) -> 1 month elapsed', monthsRemainingInCycle(new Date('2025-01-31T00:00:00Z'), new Date('2025-03-01T00:00:00Z')), 11)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
