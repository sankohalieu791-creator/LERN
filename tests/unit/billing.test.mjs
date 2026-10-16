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
  if (band === '1-99') return Math.min(learners * 50, 4000)
  if (band === '100-299') return 4000
  if (band === '300-599') return 6000
  return null
}

function institutionBandFor(students) {
  if (students < 750) return 'under-750'
  if (students < 1500) return '750-1499'
  if (students < 2500) return '1500-2499'
  if (students < 4000) return '2500-3999'
  if (students < 6000) return '4000-5999'
  return '6000+'
}
const INSTITUTION_BAND_PRICE = {
  'under-750': 1500, '750-1499': 2000, '1500-2499': 2500,
  '2500-3999': 3000, '4000-5999': 4500, '6000+': null,
}
function institutionAnnualPrice(students) {
  return INSTITUTION_BAND_PRICE[institutionBandFor(students)]
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

console.log('\n--- Provider band boundaries + prices (August list) ---')
eq('1 learner price', providerAnnualPrice(1), 50)
eq('50 learners price', providerAnnualPrice(50), 2500)
eq('79 learners price (just under cap)', providerAnnualPrice(79), 3950)
eq('80 learners price (cap kicks in, 80*50=4000)', providerAnnualPrice(80), 4000)
eq('99 learners band', providerBandFor(99), '1-99')
eq('99 learners price (capped)', providerAnnualPrice(99), 4000)
eq('100 learners band', providerBandFor(100), '100-299')
eq('100 learners price', providerAnnualPrice(100), 4000)
eq('299 learners band', providerBandFor(299), '100-299')
eq('299 learners price', providerAnnualPrice(299), 4000)
eq('300 learners band', providerBandFor(300), '300-599')
eq('300 learners price', providerAnnualPrice(300), 6000)
eq('599 learners band', providerBandFor(599), '300-599')
eq('599 learners price', providerAnnualPrice(599), 6000)
eq('600 learners band', providerBandFor(600), '600+')
eq('600 learners price (on application)', providerAnnualPrice(600), null)

console.log('\n--- Institution band boundaries + prices (16 Oct 2026 flat bands) ---')
eq('1 student', institutionAnnualPrice(1), 1500)
eq('749 students (top of under-750)', institutionAnnualPrice(749), 1500)
eq('750 students (bottom of next band)', institutionAnnualPrice(750), 2000)
eq('1499 students (top of 750-1499)', institutionAnnualPrice(1499), 2000)
eq('1500 students (bottom of 1500-2499)', institutionAnnualPrice(1500), 2500)
eq('2000 students (screenshot case, was £5,125 under the old formula)', institutionAnnualPrice(2000), 2500)
eq('2499 students (top of 1500-2499)', institutionAnnualPrice(2499), 2500)
eq('2500 students (bottom of 2500-3999)', institutionAnnualPrice(2500), 3000)
eq('3999 students (top of 2500-3999)', institutionAnnualPrice(3999), 3000)
eq('4000 students (bottom of 4000-5999)', institutionAnnualPrice(4000), 4500)
eq('5999 students (top of 4000-5999)', institutionAnnualPrice(5999), 4500)
eq('6000 students (on request)', institutionAnnualPrice(6000), null)
eq('100000 students (on request)', institutionAnnualPrice(100000), null)

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
