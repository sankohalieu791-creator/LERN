'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Compass, User, Plus, Video, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import CreatePost from '@/components/CreatePost'
import CreateCourse from '@/components/CreateCourse'
import CreateWorkshop from '@/components/CreateWorkshop'

export default function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [showMenu,    setShowMenu]    = useState(false)
  const [showPost,    setShowPost]    = useState(false)
  const [showCourse,  setShowCourse]  = useState(false)
  const [showWS,      setShowWS]      = useState(false)

  if (pathname === '/' || pathname.startsWith('/auth') || /^\/feed\/.+/.test(pathname)) return null

  const active = (p: string) => pathname === p || pathname.startsWith(p + '/')
  const isInstructor = user?.account_type === 'instructor'

  const linkCls = (p: string) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
      active(p) ? 'text-white' : 'text-[#444]'
    }`

  return (
    <>
      {/* backdrop */}
      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

      {/* popup menu above + button */}
      {showMenu && (
        <div
          className="fixed z-50 flex flex-col gap-2.5 items-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 74px)', left: '50%', transform: 'translateX(-50%)' }}
        >
          {isInstructor && (
            <button
              onClick={() => { setShowMenu(false); setShowWS(true) }}
              className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl whitespace-nowrap"
            >
              <Users className="w-4 h-4" /> Create Workshop
            </button>
          )}
          {isInstructor && (
            <button
              onClick={() => { setShowMenu(false); setShowCourse(true) }}
              className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" /> Create Course
            </button>
          )}
          <button
            onClick={() => { setShowMenu(false); setShowPost(true) }}
            className="flex items-center gap-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl whitespace-nowrap"
          >
            <Video className="w-4 h-4" /> Post Video
          </button>
        </div>
      )}

      {/* nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f0f] border-t border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center" style={{ height: '60px' }}>
          <Link href="/feed"       className={linkCls('/feed')}>
            <Home    className="w-6 h-6" />
            <span className="text-[10px] font-medium">Feed</span>
          </Link>
          <Link href="/courses"    className={linkCls('/courses')}>
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-medium">Courses</span>
          </Link>

          {/* centre plus — raised above bar */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '72px' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center bg-white rounded-full shadow-lg active:scale-95 transition-transform"
              style={{ width: '46px', height: '46px', marginTop: '-16px' }}
            >
              <Plus className={`w-6 h-6 text-black transition-transform duration-200 ${showMenu ? 'rotate-45' : ''}`} />
            </button>
          </div>

          <Link href="/discovery"  className={linkCls('/discovery')}>
            <Compass className="w-6 h-6" />
            <span className="text-[10px] font-medium">Discover</span>
          </Link>
          <Link href="/profile/me" className={linkCls('/profile/me')}>
            <User    className="w-6 h-6" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </div>
        {/* safe area fill */}
        <div style={{ height: 'env(safe-area-inset-bottom)', background: '#0f0f0f' }} />
      </nav>

      <CreatePost     isOpen={showPost}   onClose={() => setShowPost(false)}   />
      <CreateCourse   isOpen={showCourse} onClose={() => setShowCourse(false)} />
      <CreateWorkshop isOpen={showWS}     onClose={() => setShowWS(false)}     />
    </>
  )
}