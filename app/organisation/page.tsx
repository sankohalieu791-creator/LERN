'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMyOrganisation, getOrgMembers, getOrgCourses } from '@/lib/supabase'
import {
  Loader2, ChevronLeft, Users, BookOpen, Copy, Check,
  Building2, Link2, Plus, Calendar,
} from 'lucide-react'
import Link from 'next/link'

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OrganisationPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [org,     setOrg]     = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'students' | 'courses'>('students')
  const [copied,  setCopied]  = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: orgData } = await getMyOrganisation(user.id)
      if (!orgData) { setLoading(false); return }
      setOrg(orgData)
      const [{ data: m }, { data: c }] = await Promise.all([
        getOrgMembers(orgData.id),
        getOrgCourses(orgData.id),
      ])
      setMembers(m ?? [])
      setCourses(c ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  const copy = (type: 'code' | 'link') => {
    const text = type === 'code'
      ? org.join_code
      : `${window.location.origin}/join/${org.slug}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!org) return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center px-8 gap-4">
      <Building2 className="w-12 h-12 text-[#333]" />
      <p className="text-white font-bold text-lg">No Organisation</p>
      <p className="text-[#555] text-sm text-center">
        You don&apos;t manage an organisation yet. Contact support to set one up.
      </p>
      <button onClick={() => router.back()} className="text-[#FF6B2B] text-sm font-semibold">← Go back</button>
    </div>
  )

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${org.slug}` : `/join/${org.slug}`

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[#888] text-xs">Organisation Dashboard</p>
            <h1 className="text-white font-bold text-sm truncate">{org.name}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 space-y-5">

        {/* Org card */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            {org.logo_url
              ? <img src={org.logo_url} alt={org.name} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
              : <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
            }
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base leading-tight">{org.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-[#555] text-xs">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {members.length} students</span>
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {courses.length} courses</span>
              </div>
            </div>
          </div>

          {/* Join code */}
          <div className="bg-[#111] rounded-xl p-3 mb-3">
            <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Join Code</p>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xl tracking-[0.3em]">{org.join_code}</span>
              <button
                onClick={() => copy('code')}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                  copied === 'code' ? 'bg-green-500/20 text-green-400' : 'bg-[#1e1e1e] text-[#888]'
                }`}
              >
                {copied === 'code' ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          </div>

          {/* Invite link */}
          <div className="bg-[#111] rounded-xl p-3">
            <p className="text-[#555] text-[10px] font-bold uppercase tracking-wider mb-1">Invite Link</p>
            <div className="flex items-center gap-2">
              <p className="text-[#888] text-xs flex-1 truncate">{inviteLink}</p>
              <button
                onClick={() => copy('link')}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 transition ${
                  copied === 'link' ? 'bg-green-500/20 text-green-400' : 'bg-[#1e1e1e] text-[#888]'
                }`}
              >
                {copied === 'link'
                  ? <><Check className="w-3.5 h-3.5" /> Copied</>
                  : <><Link2 className="w-3.5 h-3.5" /> Copy Link</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(255,255,255,0.07)]">
          {([
            { id: 'students', label: `Students (${members.length})`, icon: Users },
            { id: 'courses',  label: `Courses (${courses.length})`,  icon: BookOpen },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 text-sm font-semibold transition ${
                tab === t.id ? 'border-white text-white' : 'border-transparent text-[#444]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Students tab */}
        {tab === 'students' && (
          <div>
            {members.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
                <p className="text-[#555] text-sm">No students yet</p>
                <p className="text-[#333] text-xs mt-1">Share the invite link or join code with your students</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m: any) => (
                  <Link
                    key={m.id}
                    href={`/profile/${m.user_id}`}
                    className="flex items-center gap-3 bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-3.5 active:opacity-75 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                      {m.users?.avatar_url
                        ? <img src={m.users.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (m.users?.username?.[0] ?? '?').toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{m.users?.username ?? 'Student'}</p>
                      <p className="text-[#555] text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Joined {timeAgo(m.joined_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Courses tab */}
        {tab === 'courses' && (
          <div>
            {courses.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
                <p className="text-[#555] text-sm">No private courses yet</p>
                <p className="text-[#333] text-xs mt-1">Create a course and set it to Private to see it here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/courses/${c.id}`}
                    className="flex gap-3 items-center bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 active:opacity-75 transition"
                  >
                    <div className="w-16 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B2B] flex-shrink-0 overflow-hidden">
                      {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-bold text-sm line-clamp-1 flex-1">{c.title}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B2B]/20 text-[#FF6B2B] flex-shrink-0">Private</span>
                      </div>
                      {c.subject && (
                        <p className="text-[#FF6B2B] text-[10px] font-bold uppercase tracking-wide">{c.subject}</p>
                      )}
                      <p className="text-[#555] text-xs mt-0.5">{c.enrolled_count ?? 0} enrolled</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
