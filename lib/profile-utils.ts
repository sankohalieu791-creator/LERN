// Shared logic for the "Verified Skill Profile" — age banding and the
// student title rule (organisation name > "Student" if under 18 > nothing).

export function computeAgeFromDob(dob?: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const beforeBirthdayThisYear =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (beforeBirthdayThisYear) age--
  return age
}

export function getAgeBand(dob?: string | null): string | null {
  const age = computeAgeFromDob(dob)
  if (age === null) return null
  if (age < 18) return 'Under 18'
  if (age <= 24) return '18–24'
  if (age <= 34) return '25–34'
  if (age <= 44) return '35–44'
  if (age <= 54) return '45–54'
  return '55+'
}

export function isAdult(dob?: string | null): boolean {
  const age = computeAgeFromDob(dob)
  return age !== null && age >= 18
}

// Students: org name if affiliated, else "Student" if under 18, else nothing.
// Instructors/employers keep their own free-text title — call sites should
// only use this for account_type === 'student'.
export function getStudentDisplayTitle(
  dob?: string | null,
  orgName?: string | null
): string | null {
  if (orgName) return orgName
  const age = computeAgeFromDob(dob)
  if (age !== null && age < 18) return 'Student'
  return null
}
