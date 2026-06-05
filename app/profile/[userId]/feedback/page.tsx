'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { addFeedback, createNotification } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { Star } from 'lucide-react'

export default function LeaveFeedbackPage() {
  const { userId } = useParams()
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || rating === 0 || !feedback.trim()) return

    setLoading(true)
    try {
      const senderName = (user as any).username ?? user.email?.split('@')[0]
      await addFeedback(userId as string, user.id, rating, feedback)
      sendPush(userId as string, '⭐ New feedback', `${senderName} gave you ${rating}-star feedback`, `/profile/${userId}`)
      createNotification(userId as string, 'feedback', '⭐ New feedback', `${senderName} gave you ${rating}-star feedback`, `/profile/${userId}`)
      setSubmitted(true)
      setRating(0)
      setFeedback('')

      setTimeout(() => {
        window.history.back()
      }, 2000)
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#2ECC71] rounded-full flex items-center justify-center mx-auto mb-4">
            <p className="text-white text-3xl">✓</p>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Feedback Submitted</h2>
          <p className="text-[#888]">Thank you for your feedback!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <h1 className="text-white text-2xl font-bold">Leave Feedback</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* RATING */}
          <div>
            <label className="block text-white font-bold mb-4">Rating</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-[#888]'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* FEEDBACK TEXT */}
          <div>
            <label className="block text-white font-bold mb-2">Your Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your experience working with this person..."
              className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-3 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none resize-none h-32"
            />
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading || rating === 0 || !feedback.trim()}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}
