'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOrgBySlug, joinOrganisation, supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, Building2 } from 'lucide-react'
import Link from 'next/link'

function JoinInner() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [org,      setOrg]      = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [joining,  setJoining]  = useState(false)
  const [joined,   setJoined]   = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: orgData } = await getOrgBySlug(slug)
      setOrg(orgData)
      if (orgData && user) {
        const { data: membership } = await supabase
          .from('organisation_members')
          .select('id')
          .eq('organisation_id', orgData.id)
          .eq('user_id', user.id)
          .maybeSingle()
        setAlreadyMember(!!membership)
      }
      setLoading(false)
    }
    load()
  }, [slug, user])

  const handleJoin = async () => {
    if (!user) {
      // Redirect to login, come back after
      router.push(`/auth/login?redirect=/join/${slug}`)
      return
    }
    if (!org) return
    setJoining(true)
    const { error: joinErr } = await joinOrganisation(user.id, org.id)
    if (joinErr) {
      setError('Something went wrong. Try again.')
    } else {
      setJoined(true)
    }
    setJoining(false)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!org) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-4">
      <Building2 className="w-12 h-12 text-[#333]" />
      <p className="text-white font-bold text-lg">Institution not found</p>
      <p className="text-[#555] text-sm text-center">This invite link may be invalid or expired.</p>
      <Link href="/courses" className="text-[#FF6B2B] text-sm font-semibold mt-2">Browse public courses →</Link>
    </div>
  )

  if (joined || alreadyMember) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-5"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-400" />
      </div>
      {org.logo_url && (
        <img src={org.logo_url} alt={org.name} className="w-16 h-16 rounded-2xl object-cover" />
      )}
      <div className="text-center">
        <p className="text-white font-bold text-xl mb-1">
          {alreadyMember ? 'Already a member' : "You've joined!"}
        </p>
        <p className="text-[#888] text-sm">{org.name}</p>
      </div>
      <p className="text-[#555] text-sm text-center">
        Your institution&apos;s private courses will now appear alongside public courses.
      </p>
      <button
        onClick={() => router.push('/courses')}
        className="w-full max-w-xs bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl"
      >
        View Courses
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-6"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {org.logo_url ? (
        <img src={org.logo_url} alt={org.name} className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
      ) : (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center">
          <Building2 className="w-10 h-10 text-white" />
        </div>
      )}

      <div className="text-center">
        <p className="text-[#FF6B2B] text-xs font-bold uppercase tracking-[0.2em] mb-2">Institution Invite</p>
        <h1 className="text-white font-bold text-2xl mb-2">{org.name}</h1>
        <p className="text-[#666] text-sm leading-relaxed">
          Join to access your institution&apos;s private courses, workshops, and content — only available to members.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-2">{error}</p>
      )}

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {joining
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
            : user ? `Join ${org.name}` : 'Sign in to Join'
          }
        </button>
        <Link href="/courses" className="block text-center text-[#555] text-sm py-2">
          Not now
        </Link>
      </div>
    </div>
  )
}

export default function JoinBySlugPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
      </div>
    }>
      <JoinInner />
    </Suspense>
  )
}
