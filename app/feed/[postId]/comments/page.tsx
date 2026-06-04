'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getComments, addComment, getVideoById } from '@/lib/supabase'
import { Comment, Video } from '@/lib/types'
import { Send } from 'lucide-react'

export default function CommentsPage() {
  const { postId } = useParams()
  const { user } = useAuth()
  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: videoData } = await getVideoById(postId as string)
        setVideo(videoData)

        const { data: commentsData } = await getComments(postId as string)
        setComments(commentsData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [postId])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim()) return

    setSubmitting(true)
    try {
      await addComment(postId as string, user.id, newComment)
      setNewComment('')

      const { data } = await getComments(postId as string)
      setComments(data || [])
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <h1 className="text-white text-2xl font-bold">{video?.title}</h1>
        <p className="text-[#888] text-sm mt-1">{comments.length} comments</p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* COMMENT INPUT */}
        {user && (
          <form onSubmit={handleAddComment} className="mb-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex-shrink-0" />
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-3 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-3">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submitting}
                    className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* COMMENTS LIST */}
        <div className="space-y-6">
          {comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#888]">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex-shrink-0" />
                <div className="flex-1">
                  <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-bold">{comment.users?.username}</p>
                      {comment.users?.verified && (
                        <span className="text-[#2ECC71]">✓</span>
                      )}
                    </div>
                    <p className="text-[#888] text-sm">{comment.text}</p>
                  </div>
                  <div className="flex gap-4 mt-2 text-[#888] text-xs">
                    <button className="hover:text-white transition">Like</button>
                    <button className="hover:text-white transition">Reply</button>
                    <span>2 hours ago</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
