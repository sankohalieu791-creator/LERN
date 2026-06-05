'use client'

import { useState } from 'react'
import { Plus, Video, BookOpen, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import CreatePost from '@/components/CreatePost'
import CreateCourse from '@/components/CreateCourse'
import CreateWorkshop from '@/components/CreateWorkshop'

export default function PlusButton() {
  const pathname = usePathname()
  const [showMenu,           setShowMenu]           = useState(false)
  const [showCreatePost,     setShowCreatePost]     = useState(false)
  const [showCreateCourse,   setShowCreateCourse]   = useState(false)
  const [showCreateWorkshop, setShowCreateWorkshop] = useState(false)

  // Hide on auth pages, classroom pages, and individual post pages
  if (pathname === '/' || pathname.startsWith('/auth') || pathname.includes('/classroom') || /^\/feed\/.+/.test(pathname)) return null

  const options = [
    { label: 'Post Video',      icon: Video,    action: () => { setShowMenu(false); setShowCreatePost(true) }     },
    { label: 'Create Course',   icon: BookOpen, action: () => { setShowMenu(false); setShowCreateCourse(true) }   },
    { label: 'Create Workshop', icon: Users,    action: () => { setShowMenu(false); setShowCreateWorkshop(true) } },
  ]

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40">
        {showMenu && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end">
            {options.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  className="flex items-center gap-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.12)] text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-[#252525] transition whitespace-nowrap shadow-lg"
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:bg-[#eee] transition active:scale-95"
        >
          <Plus className={`w-6 h-6 transition-transform duration-200 ${showMenu ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <CreatePost     isOpen={showCreatePost}     onClose={() => setShowCreatePost(false)}     />
      <CreateCourse   isOpen={showCreateCourse}   onClose={() => setShowCreateCourse(false)}   />
      <CreateWorkshop isOpen={showCreateWorkshop} onClose={() => setShowCreateWorkshop(false)} />
    </>
  )
}
