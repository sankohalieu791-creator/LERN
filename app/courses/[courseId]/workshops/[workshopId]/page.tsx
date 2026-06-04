'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Workshop } from '@/lib/types'

export default function WorkshopDetailPage() {
  const { workshopId } = useParams()
  const { user } = useAuth()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  useEffect(() => {
    const fetchWorkshop = async () => {
      try {
        const { data } = await supabase
          .from('workshops')
          .select('*, users(*)')
          .eq('id', workshopId)
          .single()

        setWorkshop(data)

        if (user) {
          const { data: enrollmentData } = await supabase
            .from('enrollments')
            .select('*')
            .eq('workshop_id', workshopId)
            .eq('user_id', user.id)
            .single()

          setEnrolled(!!enrollmentData)
        }
      } catch (error) {
        console.error('Error fetching workshop:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWorkshop()
  }, [workshopId, user])

  const handleEnroll = async () => {
    if (!user || !workshop) return

    try {
      await supabase
        .from('enrollments')
        .insert([{ workshop_id: workshop.id, user_id: user.id }])

      setEnrolled(true)
      setShowEnrollModal(false)
    } catch (error) {
      console.error('Error enrolling:', error)
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

  if (!workshop) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#888]">Workshop not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HERO */}
      <div className="relative bg-[#1a1a1a] aspect-video overflow-hidden">
        {workshop.thumbnail_url ? (
          <img
            src={workshop.thumbnail_url}
            alt={workshop.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex items-center justify-center">
            <p className="text-white text-xl">Workshop Cover</p>
          </div>
        )}

        {workshop.is_live && (
          <div className="absolute top-6 right-6 bg-[#FF3B30] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE NOW
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-white text-4xl font-bold mb-4">{workshop.title}</h1>

          {/* INSTRUCTOR */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[rgba(124,58,237,0.1)]">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED]" />
            <div>
              <p className="text-white font-bold">
                {workshop.users?.username}
                {workshop.users?.verified && ' ✓'}
              </p>
              <p className="text-[#888] text-sm">Instructor</p>
            </div>
            <button className="ml-auto bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition">
              Follow
            </button>
          </div>

          {/* DESCRIPTION */}
          <p className="text-[#888] text-lg mb-8">{workshop.description}</p>

          {/* DETAILS */}
          <div className="grid md:grid-cols-2 gap-6 mb-8 p-6 bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-[#FF6B2B]" />
              <div>
                <p className="text-[#888] text-sm">Date</p>
                <p className="text-white font-bold">{workshop.workshop_date}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#00D9FF]" />
              <div>
                <p className="text-[#888] text-sm">Time</p>
                <p className="text-white font-bold">{workshop.workshop_time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-[#7C3AED]" />
              <div>
                <p className="text-[#888] text-sm">Location</p>
                <p className="text-white font-bold">
                  {workshop.is_online ? 'Online' : workshop.location}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-[#2ECC71]" />
              <div>
                <p className="text-[#888] text-sm">Enrolled</p>
                <p className="text-white font-bold">
                  {workshop.enrolled_count} / {workshop.max_participants}
                </p>
              </div>
            </div>
          </div>

          {/* ENROLL BUTTON */}
          {!enrolled ? (
            <button
              onClick={() => setShowEnrollModal(true)}
              className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-8 py-4 rounded-lg font-bold hover:shadow-lg transition"
            >
              Enroll Now - FREE
            </button>
          ) : workshop.is_live ? (
            <button className="bg-[#2ECC71] text-white px-8 py-4 rounded-lg font-bold hover:bg-[#27AE60] transition">
              Join Workshop Now
            </button>
          ) : (
            <div className="bg-[rgba(46,204,113,0.2)] border border-[#2ECC71] text-[#2ECC71] px-8 py-4 rounded-lg font-bold">
              ✓ You&apos;re Enrolled
            </div>
          )}
        </div>
      </div>

      {/* ENROLL MODAL */}
      {showEnrollModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEnrollModal(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white text-2xl font-bold mb-6">Enroll in Workshop</h2>

            <div className="mb-6 space-y-4">
              <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg p-4">
                <p className="text-white font-bold">{workshop.title}</p>
                <p className="text-[#888] text-sm mt-2">by {workshop.users?.username}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-white">
                  <span>Date &amp; Time:</span>
                  <span className="font-bold">{workshop.workshop_date}</span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Location:</span>
                  <span className="font-bold">
                    {workshop.is_online ? 'Online' : workshop.location}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Available Spots:</span>
                  <span className="font-bold">
                    {workshop.max_participants - workshop.enrolled_count}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span>Price:</span>
                  <span className="font-bold text-[#2ECC71]">FREE</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleEnroll}
              className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition mb-3"
            >
              Confirm Enrollment
            </button>

            <button
              onClick={() => setShowEnrollModal(false)}
              className="w-full bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white font-bold py-3 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
