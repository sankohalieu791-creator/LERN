'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getNotifications } from '@/lib/supabase'

export default function Navbar() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data } = await getNotifications(user.id)
      setNotifications((data || []).filter((n: any) => !n.read))
    }
    load()
  }, [user])

  return (
    <nav className="sticky top-0 z-40 bg-[#111] border-b border-[rgba(255,255,255,0.07)]">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-white font-bold text-xl tracking-tight">LERN</span>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] hover:bg-[#252525] transition"
          >
            <Bell className="w-4 h-4 text-white" />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 w-72 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
                <h3 className="text-white font-bold text-sm">Notifications</h3>
                <button onClick={() => setShowNotifications(false)}>
                  <X className="w-4 h-4 text-[#666]" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[#444] text-sm">No notifications</div>
                ) : (
                  notifications.map((notif: any) => (
                    <div key={notif.id} className="px-4 py-3 border-b border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)]">
                      <p className="text-white text-xs capitalize">{notif.type}</p>
                      <p className="text-[#444] text-[11px] mt-0.5">{new Date(notif.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
