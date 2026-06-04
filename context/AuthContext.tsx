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
        const authUser = await getUser()
        setAuthUser(authUser)

        if (authUser) {
          const { data } = await getUserProfile(authUser.id)
          setUser(data)
        }
      } catch (error) {
        console.error('Auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

    return () => subscription.unsubscribe()
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
