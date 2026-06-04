'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getVideos, getCourses } from '@/lib/supabase'
import { Video, Course } from '@/lib/types'
import Link from 'next/link'
import { Star } from 'lucide-react'

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [videos, setVideos] = useState<Video[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const search = async () => {
      if (!query) {
        setLoading(false)
        return
      }

      try {
        const { data: videosData } = await getVideos()
        const { data: coursesData } = await getCourses()

        const filteredVideos = videosData?.filter(v =>
          v.title.toLowerCase().includes(query.toLowerCase()) ||
          v.description?.toLowerCase().includes(query.toLowerCase())
        ) || []

        const filteredCourses = coursesData?.filter(c =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase())
        ) || []

        setVideos(filteredVideos)
        setCourses(filteredCourses)
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <h1 className="text-white text-2xl font-bold">Search Results</h1>
        <p className="text-[#888] text-sm mt-1">
          {videos.length + courses.length} results for &quot;{query}&quot;
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {videos.length === 0 && courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888]">No results found for &quot;{query}&quot;</p>
          </div>
        ) : (
          <>
            {/* VIDEOS */}
            {videos.length > 0 && (
              <div className="mb-12">
                <h2 className="text-white text-xl font-bold mb-6">Videos</h2>
                <div className="space-y-4">
                  {videos.map(video => (
                    <Link
                      key={video.id}
                      href={`/feed/${video.id}`}
                      className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg p-4 hover:border-[rgba(124,58,237,0.3)] transition flex gap-4 cursor-pointer"
                    >
                      <div className="w-32 h-20 rounded-lg bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-white font-bold hover:text-[#00D9FF] transition">
                          {video.title}
                        </h3>
                        <p className="text-[#888] text-sm mt-1 line-clamp-2">
                          {video.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-[#888] text-xs">
                          <span>{video.views} views</span>
                          <span>{video.duration}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* COURSES */}
            {courses.length > 0 && (
              <div>
                <h2 className="text-white text-xl font-bold mb-6">Courses</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map(course => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg overflow-hidden hover:border-[rgba(124,58,237,0.3)] transition group cursor-pointer"
                    >
                      <div className="aspect-video bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED]" />
                      <div className="p-4">
                        <h3 className="text-white font-bold text-sm mb-2 group-hover:text-[#00D9FF] transition line-clamp-2">
                          {course.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-[#888]">
                          <span>{course.duration_weeks} weeks</span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400" />
                            {course.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full animate-spin" />
        </div>
      }>
        <SearchResults />
      </Suspense>
    </div>
  )
}
