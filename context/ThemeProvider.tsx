'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

// Resolves the user's stored theme_preference (light/dark/system) to an
// actual light/dark value and exposes it via context — deliberately does
// NOT set anything on <html>. Only OrgShell (institution/provider)
// applies data-theme on its own root, so every other page (auth, student,
// employer) is structurally unable to inherit dark mode and always
// renders with the light :root tokens, regardless of OS/account
// preference. That's not an oversight: those surfaces were never
// converted to the token system, so letting a global dark attribute
// reach them puts var(--ink) text on still-literal-white backgrounds —
// exactly the "pure white, can't read it" bug this replaces.
const ThemeContext = createContext<'light' | 'dark'>('light')
export const useResolvedTheme = () => useContext(ThemeContext)

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const preference = user?.theme_preference || 'system'
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setResolved(preference === 'system' ? (mql.matches ? 'dark' : 'light') : preference)
    apply()
    if (preference === 'system') {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
  }, [preference])

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
