'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { amIFollowing, followUser, unfollowUser } from '@/lib/supabase'
import { Plus, Check } from 'lucide-react'

// The `followers` table and amIFollowing/followUser/unfollowUser in
// lib/supabase.ts already existed -- nothing in the UI ever called
// them, so following someone was never actually possible anywhere in
// the app. This is that missing control: a full pill for a profile
// header, or a small icon badge next to an avatar (Feed post cards),
// same state and calls either way.
export default function FollowButton({
  profileId, variant = 'pill', onChange,
}: {
  profileId: string
  variant?: 'pill' | 'icon'
  onChange?: (following: boolean) => void
}) {
  const { user } = useAuth()
  const [following, setFollowing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || user.id === profileId) { setFollowing(null); return }
    amIFollowing(user.id, profileId).then(setFollowing)
  }, [user?.id, profileId])

  // Never shown on your own avatar/profile, and nothing to render
  // until the initial check has actually come back -- flashing
  // "Follow" then immediately to "Following" reads as a glitch.
  if (!user || user.id === profileId || following === null) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    const next = !following
    setFollowing(next)
    const { error } = next ? await followUser(user.id, profileId) : await unfollowUser(user.id, profileId)
    setBusy(false)
    if (error) { setFollowing(!next); return }
    onChange?.(next)
  }

  if (variant === 'icon') {
    // A bare "+", not a filled circle badge -- Instagram/TikTok's own
    // follow affordance next to a name is just the glyph itself, no
    // background shape around it.
    return (
      <button
        onClick={e => { e.stopPropagation(); toggle() }} disabled={busy}
        aria-label={following ? 'Unfollow' : 'Follow'} title={following ? 'Following' : 'Follow'}
        className="w-5 h-5 flex items-center justify-center flex-shrink-0 transition disabled:opacity-60"
        style={{ color: following ? 'var(--app-text-tertiary)' : '#F26B21' }}
      >
        {following ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
      </button>
    )
  }

  return (
    <button
      onClick={toggle} disabled={busy}
      className="mt-4 px-6 py-2 rounded-full text-[13px] font-semibold active:scale-[0.98] transition disabled:opacity-60"
      style={following
        ? { border: '1px solid var(--app-overlay-3)', color: 'var(--app-text)', backgroundColor: 'transparent' }
        : { backgroundColor: '#F26B21', color: '#fff', border: '1px solid transparent' }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
