import type { SkillLevel } from '@/lib/types'

// Shared across SkillWalletPanel, the Profile 'skills' tab, and the
// employer-facing candidate modal -- was three independent copies of
// the same level→colour/label map before, drifting apart was a matter
// of time.
export const LEVEL_INFO: Record<SkillLevel, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not started', bg: 'var(--app-overlay-2)', text: 'var(--app-text-tertiary)' },
  beginner: { label: 'Beginner', bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  developing: { label: 'Developing', bg: 'var(--status-warn-bg)', text: 'var(--status-warn-text)' },
  secure: { label: 'Secure', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  advanced: { label: 'Advanced', bg: '#F3E8FF', text: '#7C3AED' },
}
