'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { setThemePreference } from '@/lib/supabase'
import { Sun, Moon, Monitor } from 'lucide-react'

// Same mechanism as the customer app's Settings > Appearance (a
// theme_preference on the account, resolved by ThemeProvider), just
// hosted here since /ops has no other settings screen at all yet.
export default function OpsSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const saveTheme = async (theme: 'light' | 'dark' | 'system') => {
    setBusy(true)
    await setThemePreference(user.id, theme)
    await refreshUser()
    setBusy(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Settings</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Signed in as {user.email}.</p>

      <div className="bg-surface border border-edge rounded-2xl p-5">
        <p className="text-[14px] font-semibold text-ink mb-3">Appearance</p>
        <div className="flex gap-2">
          {([['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]] as const).map(([key, label, Icon]) => (
            <button
              key={key} onClick={() => saveTheme(key)} disabled={busy}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                (user.theme_preference || 'system') === key ? 'bg-brand text-white' : 'bg-surface-subtle border border-edge text-ink-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
