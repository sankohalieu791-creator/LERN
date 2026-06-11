'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getVideos, getCourses } from '@/lib/supabase'
import { Video, Course } from '@/lib/types'
import Link from 'next/link'
import { Star, Play } from 'lucide-react'

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
  const [videos, setVideos] = useState<Video[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const search = async () => {
      if (!query) { setLoading(false); return }
      try {
        const { data: videosData } = await getVideos()
        const { data: coursesData } = await getCourses()

        setVideos(
          (videosData || []).filter(v =>
            v.title.toLowerCase().includes(query.toLowerCase()) ||
            v.description?.toLowerCase().includes(query.toLowerCase())
          )
        )
        setCourses(
          (coursesData || []).filter(c =>
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            c.description?.toLowerCase().includes(query.toLowerCase())
          )
        )
      } catch (error) {
        console.error('Error searching:', error)
      } finally {
        setLoading(false)
      }
    }
    search()
  }, [query])

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const total = videos.length + courses.length

  return (
    <div className="px-4 pt-4 pb-24 space-y-6">
      <p className="text-[#555] text-sm">
        {query ? `${total} result${total !== 1 ? 's' : ''} for "${query}"` : 'Type something to search'}
      </p>

      {total === 0 && query && (
        <p className="text-center text-[#444] text-sm py-12">No results found</p>
      )}

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
                <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex-shrink-0 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-white text-sm font-semibold line-clamp-2 leading-snug">{video.title}</p>
                  <p className="text-[#555] text-xs mt-1">{video.views ?? 0} views</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B2B] flex-shrink-0" />
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-white text-sm font-semibold line-clamp-2 leading-snug">{course.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[#555] text-xs">
                    <span>{course.duration_weeks}w</span>
                    {course.rating > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {course.rating.toFixed(1)}
                        </span>
                      </>
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
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      }>
        <SearchResults />
      </Suspense>
    </div>
  )
}
