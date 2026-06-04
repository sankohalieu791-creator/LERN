'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Heart, MessageCircle, Share2, Eye, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProjectDetail {
  id: string
  title: string
  description: string
  studentName: string
  visibility: 'private' | 'public'
  views: number
  likes: number
  comments: number
  attachments: string[]
  createdAt: string
}

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        setProject({
          id: data.id,
          title: data.title,
          description: data.description,
          studentName: 'Student Name',
          visibility: data.visibility,
          views: Math.floor(Math.random() * 1000),
          likes: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 50),
          attachments: [],
          createdAt: data.created_at
        })
      } catch (error) {
        console.error('Error fetching project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#888]">Project not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#2ECC71] text-xs font-bold bg-[rgba(46,204,113,0.2)] px-2 py-1 rounded">
              VERIFIED SKILL
            </span>
            <span className="text-[#00D9FF] text-xs font-bold bg-[rgba(0,217,255,0.2)] px-2 py-1 rounded">
              TYPESCRIPT
            </span>
          </div>
          <h1 className="text-white text-3xl font-bold">{project.title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* PROJECT INFO */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[rgba(124,58,237,0.1)]">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED]" />
            <div className="flex-1">
              <p className="text-white font-bold">{project.studentName}</p>
              <p className="text-[#888] text-sm">Verified by Dr. Maya Chen ✓</p>
            </div>
            <button className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition">
              View Profile
            </button>
          </div>

          {/* DESCRIPTION */}
          <div className="mb-8">
            <h2 className="text-white font-bold text-lg mb-4">About This Project</h2>
            <p className="text-[#888] text-lg mb-6">{project.description}</p>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Eye className="w-5 h-5 text-[#00D9FF]" />
                <p className="text-white font-bold">{project.views}</p>
              </div>
              <p className="text-[#888] text-sm">Views</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-[#FF6B2B]" />
                <p className="text-white font-bold">{project.likes}</p>
              </div>
              <p className="text-[#888] text-sm">Likes</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-[#7C3AED]" />
                <p className="text-white font-bold">{project.comments}</p>
              </div>
              <p className="text-[#888] text-sm">Comments</p>
            </div>
          </div>

          {/* VISIBILITY */}
          <div className="flex items-center gap-2 mb-8">
            {project.visibility === 'private' ? (
              <>
                <Lock className="w-5 h-5 text-[#888]" />
                <span className="text-[#888]">Private - Only you can see this</span>
              </>
            ) : (
              <>
                <Eye className="w-5 h-5 text-[#00D9FF]" />
                <span className="text-[#00D9FF]">Public - Everyone can see this</span>
              </>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white py-3 rounded-lg transition">
              <Heart className="w-5 h-5" />
              Like
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white py-3 rounded-lg transition">
              <MessageCircle className="w-5 h-5" />
              Comment
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white py-3 rounded-lg transition">
              <Share2 className="w-5 h-5" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
