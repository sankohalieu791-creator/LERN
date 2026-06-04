'use client'

import { User } from '@/lib/types'
import Link from 'next/link'
import { Edit2, Share2, Settings } from 'lucide-react'

interface ProfileHeaderProps {
  user: User | null
  isOwnProfile: boolean
  onEditClick?: () => void
}

export default function ProfileHeader({ user, isOwnProfile, onEditClick }: ProfileHeaderProps) {
  if (!user) return null

  return (
    <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6">
      <div className="flex items-start gap-6">
        {/* AVATAR */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex-shrink-0" />

        <div className="flex-1">
          {/* NAME & BIO */}
          <div className="mb-4">
            <h1 className="text-white text-2xl font-bold">{user.username}</h1>
            {user.verified && <span className="text-[#2ECC71] text-sm">✓ Verified</span>}
            {user.title && <p className="text-[#888] text-sm mt-1">{user.title}</p>}
            {user.bio && <p className="text-white text-sm mt-2">{user.bio}</p>}
          </div>

          {/* STATS */}
          <div className="flex gap-8 mb-4">
            <div className="text-center">
              <p className="text-white font-bold text-lg">0</p>
              <p className="text-[#888] text-xs">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{user.followers_count}</p>
              <p className="text-[#888] text-xs">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{user.following_count}</p>
              <p className="text-[#888] text-xs">Following</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{user.views_count}</p>
              <p className="text-[#888] text-xs">Viewed by</p>
            </div>
          </div>

          {/* BUTTONS */}
          {isOwnProfile ? (
            <div className="flex gap-3">
              <button
                onClick={onEditClick}
                className="flex items-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition flex-1"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
              <button className="p-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white rounded-lg transition">
                <Share2 className="w-5 h-5" />
              </button>
              <Link
                href="/settings"
                className="p-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white rounded-lg transition"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="flex gap-3">
              <button className="flex-1 bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
                Follow
              </button>
              <button className="flex-1 bg-[rgba(124,58,237,0.2)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[rgba(124,58,237,0.3)] transition">
                Message
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
