'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@/lib/types'
import { supabase, getUser, getUserProfile } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  authUser: any
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROFILE_CACHE_KEY = 'lern_profile_cache'

function getCachedProfile(): User | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCachedProfile(profile: User | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Serve the cached profile immediately so the app opens without a blank screen.
    // The session check below will clear it if the session has actually expired.
    const cached = getCachedProfile()
    if (cached) {
      setUser(cached)
      setLoading(false)
    }

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          setUser(null)
          setAuthUser(null)
          setCachedProfile(null)
          setLoading(false)
          return
        }

        // If the access token is expired or expiring within 5 minutes, refresh it
        // before fetching the profile — stale tokens cause silent empty responses
        const expiresAt = (session.expires_at ?? 0) * 1000
        const needsRefresh = Date.now() > expiresAt - 5 * 60 * 1000
        let activeUser = session.user

        if (needsRefresh) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
          if (refreshErr || !refreshed.session) {
            // Refresh token also expired — clear state, user must sign in again
            setUser(null)
            setAuthUser(null)
            setCachedProfile(null)
            setLoading(false)
            return
          }
          activeUser = refreshed.session.user
        }

        setAuthUser(activeUser)
        const { data } = await getUserProfile(activeUser.id)
        if (data) {
          setUser(data)
          setCachedProfile(data)
        }
        setLoading(false)
      } catch (error) {
        console.error('Auth error:', error)
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return   // handled by initAuth above
      if (event === 'TOKEN_REFRESHED') return   // handled by handleVisibility above
      if (session?.user) {
        setAuthUser(session.user)
        const { data } = await getUserProfile(session.user.id)
        if (data) {
          setUser(data)
          setCachedProfile(data)
        }
      } else {
        setAuthUser(null)
        setUser(null)
        setCachedProfile(null)
      }
      setLoading(false)
    })

    // When the user returns after a long background period the access token may
    // have expired (browsers suspend JS timers for backgrounded tabs/PWAs, so
    // Supabase's own auto-refresh timer never fires). We call refreshSession()
    // explicitly — not getSession() — so the SDK fetches a fresh token from the
    // server before any page-level queries run. This prevents the "no internet"
    // blank-page symptom caused by stale tokens silently failing.
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed.session?.user) {
        const { data } = await getUserProfile(refreshed.session.user.id)
        if (data) {
          setUser(data)
          setCachedProfile(data)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const refreshUser = async () => {
    try {
      // Always fetch fresh auth user — avoids stale-closure bug
      const fresh = await getUser()
      if (fresh) {
        const { data } = await getUserProfile(fresh.id)
        if (data) {
          setUser(data)
          setCachedProfile(data)
        }
      }
    } catch (e) {
      console.error('refreshUser error:', e)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAuthUser(null)
    setCachedProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, authUser, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
