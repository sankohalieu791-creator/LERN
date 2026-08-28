'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

// Resolves the user's stored theme_preference (light/dark/system) to an
// actual light/dark and sets it explicitly as data-theme on <html> — the
// CSS tokens in globals.css key off that attribute, never a bare media
// query, so the resolution always matches what Settings shows regardless
// of what the OS is doing. Falls back to system preference pre-login
// (no user loaded yet) so a visitor's first paint isn't jarring.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const preference = user?.theme_preference || 'system'

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const resolved = preference === 'system' ? (mql.matches ? 'dark' : 'light') : preference
      document.documentElement.setAttribute('data-theme', resolved)
    }

    apply()
    if (preference === 'system') {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
  }, [preference])

  return <>{children}</>
}
