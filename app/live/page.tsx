'use client'

import { useState, useEffect } from 'react'
import { getLiveSessions } from '@/lib/supabase'
import { Radio, Play } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function LivePage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = () => {
    setLoading(true)
    getLiveSessions().then(({ data }) => {
      setSessions(data || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchSessions()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchSessions()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-white font-bold text-lg">Live Now</h1>
      </div>

      {loading ? (
        <div className="px-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#111] overflow-hidden animate-pulse">
              <div className="aspect-video bg-[#1e1e1e]" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-[#1e1e1e] rounded w-3/4" />
                <div className="h-3 bg-[#1e1e1e] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-28 px-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center mb-5">
            <Radio className="w-7 h-7 text-white" />
          </div>
          <p className="text-white font-semibold mb-2">No live sessions right now</p>
          <p className="text-[#555] text-sm text-center max-w-xs leading-relaxed">
            When instructors go live, you'll see them here.
          </p>
          <Link
            href="/feed"
            className="mt-8 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 px-8 rounded-full text-sm"
          >
            Browse the feed
          </Link>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {sessions.map(session => {
            const course = session.courses
            const instructor = course?.users
            return (
              <Link
                key={session.id}
                href={`/courses/${course?.id}/classroom`}
                className="block rounded-2xl bg-[#111] overflow-hidden active:scale-[0.98] transition"
              >
                <div className="aspect-video relative bg-[#1e1e1e]">
                  {course?.thumbnail_url ? (
                    <Image src={course.thumbnail_url} alt={course.title || ''} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B2B] to-[#C026D3]" />
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-[10px] font-bold uppercase">Live</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-white font-semibold text-sm line-clamp-2">{session.title} — {course?.title}</p>
                  {instructor && (
                    <p className="text-[#555] text-xs mt-1">{instructor.username}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
