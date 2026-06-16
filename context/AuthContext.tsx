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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
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
            setLoading(false)
            return
          }
          activeUser = refreshed.session.user
        }

        setAuthUser(activeUser)
        const { data } = await getUserProfile(activeUser.id)
        setUser(data)
        setLoading(false)
      } catch (error) {
        console.error('Auth error:', error)
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return  // handled by initAuth above
      if (session?.user) {
        setAuthUser(session.user)
        const { data } = await getUserProfile(session.user.id)
        setUser(data)
      } else {
        setAuthUser(null)
        setUser(null)
      }
      setLoading(false)
    })

    // When the user returns to the app after it's been in the background,
    // Supabase auto-refreshes the token via its own visibilitychange listener.
    // We re-fetch the profile here so stale data never persists on return.
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await getUserProfile(session.user.id)
        if (data) setUser(data)
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
        if (data) setUser(data)
      }
    } catch (e) {
      console.error('refreshUser error:', e)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAuthUser(null)
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
