import type { Role } from '@/lib/types'

// The single place that decides where a role lands. Both the login page
// and the root redirect use this — routing by role must be enforced by
// the verified role in the database, never something a screen guesses
// at independently.
export function routeForRole(role: Role | undefined | null): string {
  switch (role) {
    case 'student': return '/student'
    case 'institution_staff': return '/institution'
    case 'provider_staff': return '/provider'
    case 'employer': return '/employer'
    default: return '/auth/start'
  }
}
