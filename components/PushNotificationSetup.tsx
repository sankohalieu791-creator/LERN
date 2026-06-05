'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { registerPushSubscription } from '@/lib/push'

export default function PushNotificationSetup() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    if ((user as any).notif_push_enabled === false) return
    // Small delay so the page renders first before prompting
    const t = setTimeout(() => registerPushSubscription(user.id), 3000)
    return () => clearTimeout(t)
  }, [user?.id])

  return null
}
