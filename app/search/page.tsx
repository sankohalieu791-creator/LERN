'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Star, Play, User } from 'lucide-react'

function SkeletonCard() {
  return (
    <div className="flex gap-3 p-4 bg-[#111] rounded-2xl animate-pulse">
      <div className="w-20 h-14 rounded-xl bg-[#1e1e1e] flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 bg-[#1e1e1e] rounded w-3/4" />
        <div className="h-3 bg-[#1e1e1e] rounded w-1/2" />
      </div>
    </div>
  )
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [videos,  setVideos]  = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [people,  setPeople]  = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setVideos([]); setCourses([]); setPeople([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const [
          { data: v },
          { data: c },
          { data: u },
        ] = await Promise.all([
          supabase
            .from('videos')
            .select('id, title, description, views, thumbnail_url')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .order('views', { ascending: false })
            .limit(20),
          supabase
            .from('courses')
            .select('id, title, description, duration_weeks, rating, thumbnail_url')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(20),
          supabase
            .from('users')
            .select('id, username, avatar_url, title, verified, account_type, followers_count')
            .or(`username.ilike.%${query}%,title.ilike.%${query}%`)
            .order('followers_count', { ascending: false })
            .limit(20),
        ])
        setVideos(v || [])
        setCourses(c || [])
        setPeople(u || [])
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const total = videos.length + courses.length + people.length

  if (!query.trim()) {
    return (
      <div className="px-4 pt-8 text-center">
        <p className="text-[#444] text-sm">Type to search for people, videos, or courses</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      <p className="text-[#555] text-sm">
        {total} result{total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </p>

      {total === 0 && (
        <p className="text-center text-[#444] text-sm py-12">No results found</p>
      )}

      {/* PEOPLE — shown first like TikTok */}
      {people.length > 0 && (
        <div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-3">People</p>
          <div className="space-y-1">
            {people.map(person => (
              <Link
                key={person.id}
                href={`/profile/${person.id}`}
                className="flex items-center gap-3 py-3 active:opacity-70 transition border-b border-[rgba(255,255,255,0.04)] last:border-0"
              >
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">
                      {person.username?.[0]?.toUpperCase() ?? <User className="w-5 h-5" />}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold leading-snug flex items-center gap-1">
                    {person.username}
                    {person.verified && <span className="text-[#1d9bf0] text-xs">✓</span>}
                  </p>
                  {person.title && (
                    <p className="text-[#666] text-xs mt-0.5 truncate">{person.title}</p>
                  )}
                  <p className="text-[#444] text-xs mt-0.5">
                    {person.account_type === 'instructor'
                      ? <span className="text-[#FF6B2B] font-semibold">Instructor</span>
                      : `${(person.followers_count ?? 0).toLocaleString()} followers`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* VIDEOS */}
      {videos.length > 0 && (
        <div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-3">Videos</p>
          <div className="space-y-2">
            {videos.map(video => (
              <Link
                key={video.id}
                href={`/feed/${video.id}`}
                className="flex gap-3 p-3 bg-[#111] rounded-2xl active:scale-[0.98] transition"
              >
                <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {video.thumbnail_url
                    ? <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <Play className="w-5 h-5 text-white fill-white" />
                  }
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-white text-sm font-semibold line-clamp-2 leading-snug">{video.title}</p>
                  <p className="text-[#555] text-xs mt-1">{(video.views ?? 0).toLocaleString()} views</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* COURSES */}
      {courses.length > 0 && (
        <div>
          <p className="text-[#888] text-xs font-bold uppercase tracking-widest mb-3">Courses</p>
          <div className="space-y-2">
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="flex gap-3 p-3 bg-[#111] rounded-2xl active:scale-[0.98] transition"
              >
                <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B2B] flex-shrink-0 overflow-hidden">
                  {course.thumbnail_url && (
                    <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-white text-sm font-semibold line-clamp-2 leading-snug">{course.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[#555] text-xs">
                    {course.rating > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {course.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Suspense fallback={
        <div className="px-4 pt-4 space-y-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      }>
        <SearchResults />
      </Suspense>
    </div>
  )
}
