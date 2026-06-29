'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, setWorkshopLive } from '@/lib/supabase'
import { sendPushToMany } from '@/lib/push'
import { useAuth } from '@/context/AuthContext'
import { Calendar, Clock, MapPin, Users, ChevronLeft, Loader2, Radio } from 'lucide-react'

function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

export default function WorkshopDetailPage() {
  const { workshopId } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [workshop, setWorkshop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [goingLive, setGoingLive] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('workshops')
        .select('*, users(*)')
        .eq('id', workshopId)
        .single()
      setWorkshop(data)

      if (user) {
        const { data: e } = await supabase
          .from('enrollments')
          .select('id')
          .eq('workshop_id', workshopId)
          .eq('user_id', user.id)
          .maybeSingle()
        setEnrolled(!!e)
      }
      setLoading(false)
    }
    fetch()
  }, [workshopId, user])

  // Realtime: update is_live when instructor starts/stops
  useEffect(() => {
    if (!workshopId) return
    const channel = supabase
      .channel(`workshop-live-${workshopId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'workshops',
        filter: `id=eq.${workshopId}`,
      }, (payload: any) => {
        setWorkshop((prev: any) => prev ? { ...prev, is_live: payload.new.is_live } : prev)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workshopId])

  const handleEnroll = async () => {
    if (!user) { router.push('/auth/login'); return }
    setEnrolling(true)
    await supabase.from('enrollments').insert([{ workshop_id: workshopId, user_id: user.id }])
    setEnrolled(true)
    setEnrolling(false)
  }

  const handleGoLive = async () => {
    if (!workshopId) return
    setGoingLive(true)
    const { error } = await setWorkshopLive(workshopId as string, true)
    if (!error) {
      setWorkshop((prev: any) => ({ ...prev, is_live: true }))
      // Notify enrolled students
      const { data: rows } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('workshop_id', workshopId)
      const ids = (rows || []).map((r: any) => r.user_id).filter((id: string) => id !== user?.id)
      if (ids.length) {
        sendPushToMany(
          ids,
          '🔴 Workshop is starting!',
          `${workshop?.title} is now live — join now`,
          `/courses/${workshop?.course_id}/workshops/${workshopId}`
        )
      }
      router.push(`/workshops/${workshopId}/classroom`)
    }
    setGoingLive(false)
  }

  const handleEndLive = async () => {
    if (!workshopId) return
    await setWorkshopLive(workshopId as string, false)
    setWorkshop((prev: any) => ({ ...prev, is_live: false }))
  }

  if (loading) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!workshop) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
      <p className="text-[#555]">Workshop not found</p>
    </div>
  )

  const date = workshop.workshop_date ? new Date(workshop.workshop_date) : null
  const instructorId = workshop.instructor_id || workshop.user_id
  const isInstructor = !!(user && user.id === instructorId)

  // Build a scheduled datetime for time-gating
  let scheduledAt: Date | null = null
  if (workshop.workshop_date && workshop.workshop_time) {
    scheduledAt = new Date(`${workshop.workshop_date}T${workshop.workshop_time}`)
  }
  const tooEarly = scheduledAt ? Date.now() < scheduledAt.getTime() : false

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] overflow-y-auto">

      {/* HERO */}
      <div className="relative w-full flex-shrink-0 bg-[#1a1a1a]" style={{ height: '240px' }}>
        {workshop.thumbnail_url
          ? <img src={workshop.thumbnail_url} alt={workshop.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0f3460]" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-black/30" />

        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center z-10"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        {workshop.is_live && (
          <div
            className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            LIVE NOW
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="px-4 pt-5 pb-32">

        <h1 className="text-white font-bold text-xl leading-snug mb-4">{workshop.title}</h1>

        {/* Instructor */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[rgba(255,255,255,0.07)]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
            {workshop.users?.avatar_url
              ? <img src={workshop.users.avatar_url} className="w-full h-full object-cover" />
              : workshop.users?.username?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <p className="text-white text-sm font-bold flex items-center gap-1.5">
              {workshop.users?.username}
              {workshop.users?.verified && <VerifiedBadge size={13} />}
            </p>
            <p className="text-[#555] text-xs">Instructor</p>
          </div>
        </div>

        {/* Description */}
        {workshop.description && (
          <p className="text-[#888] text-sm leading-relaxed mb-5">{workshop.description}</p>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {date && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[#FF6B2B]" />
                <p className="text-[#555] text-xs">Date</p>
              </div>
              <p className="text-white font-bold text-sm">
                {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
          {workshop.workshop_time && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#1d9bf0]" />
                <p className="text-[#555] text-xs">Time</p>
              </div>
              <p className="text-white font-bold text-sm">{workshop.workshop_time.slice(0, 5)}</p>
            </div>
          )}
          <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-[#C026D3]" />
              <p className="text-[#555] text-xs">Location</p>
            </div>
            <p className="text-white font-bold text-sm">
              {workshop.is_online ? 'Online' : (workshop.location || 'TBD')}
            </p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-green-500" />
              <p className="text-[#555] text-xs">Spots</p>
            </div>
            <p className="text-white font-bold text-sm">
              {workshop.enrolled_count || 0}{workshop.max_participants ? ` / ${workshop.max_participants}` : ' joined'}
            </p>
          </div>
        </div>
      </div>

      {/* STICKY BUTTON */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.07)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {isInstructor ? (
          // ── Instructor controls ──────────────────────────────
          workshop.is_live ? (
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/workshops/${workshopId}/classroom`)}
                className="flex-1 bg-red-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Rejoin Live
              </button>
              <button
                onClick={handleEndLive}
                className="px-5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-[#888] font-bold py-4 rounded-2xl text-sm"
              >
                End
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoLive}
              disabled={goingLive}
              className="w-full bg-gradient-to-r from-red-500 to-[#FF6B2B] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {goingLive
                ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</>
                : <><Radio className="w-4 h-4" />Start Workshop Live</>
              }
            </button>
          )
        ) : (
          // ── Student controls ─────────────────────────────────
          enrolled ? (
            workshop.is_live ? (
              <button
                onClick={() => router.push(`/workshops/${workshopId}/classroom`)}
                className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Join Workshop Now
              </button>
            ) : tooEarly ? (
              <div className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-2xl px-4 py-3 text-center">
                <p className="text-white font-bold text-sm mb-0.5">✓ You&apos;re Enrolled</p>
                <p className="text-[#555] text-xs">
                  Starts {scheduledAt?.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' at '}
                  {scheduledAt?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <div className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] text-white font-bold py-4 rounded-2xl text-center">
                ✓ Enrolled — Waiting for instructor to start
              </div>
            )
          ) : (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling…</> : 'Join Workshop — Free'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
