'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFollowCounts, getVerifiedWorkForProfile, getMyPosts, getSelfQualifications,
  addSelfQualification, deleteSelfQualification, uploadSelfQualificationFile, getSignedFileUrl, deletePost,
  updateProfileBioTags, getExperienceEntries, addExperienceEntry, deleteExperienceEntry,
  getSavedOpportunities, unsaveOpportunity, updateUserProfile, uploadAvatar, removeAvatar,
  isUsernameAvailable, getMyOrganisationInfo, getPublicStudentProfile, blockUser,
  getStudentSkills, getOrgSkillsForStudent,
  getMySkillGoals, createSkillGoal,
} from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import FollowButton from '@/components/v2/FollowButton'
import SkillGoalTimeline from '@/components/v2/SkillGoalTimeline'
import { STICKER_OPTIONS } from '@/lib/feedConstants'
import { LEVEL_INFO } from '@/lib/skillLevels'
import {
  FolderCheck, Briefcase, Grid3x3, Award, Settings as SettingsIcon, Plus, X, Trash2, Play,
  Bookmark, Lock, FilePlus, CheckCircle2, Camera, ChevronLeft, ChevronRight, ArrowRight, MoreHorizontal, UserX,
} from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function isAdult(dob?: string) {
  if (!dob) return false
  return (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25) >= 18
}
function daysAgo(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)))
}

// Experience entries used to be just a title + an optional organisation
// -- "it needs more details than that" (direct feedback). These extra
// fields (employment_type/start_date/end_date/is_current/location/
// description) are read defensively everywhere below (every usage is
// `e.field &&`-guarded) so this renders fine both before and after the
// migration that adds the columns has actually been run.
export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  work_placement: 'Work placement',
  volunteering: 'Volunteering',
  part_time: 'Part-time job',
  saturday_job: 'Saturday job',
  internship: 'Internship',
  other: 'Other',
}
function formatMonthYear(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
function formatDateRange(e: { start_date?: string; end_date?: string; is_current?: boolean }) {
  const start = formatMonthYear(e.start_date)
  if (!start) return ''
  const end = e.is_current ? 'Present' : formatMonthYear(e.end_date)
  return end ? `${start} – ${end}` : start
}

type Folder = 'verified' | 'experience' | 'posts' | 'skills' | 'saved'

// LERN Student Profile, Final Layout Spec v2.0 -- supersedes the
// earlier compact-stack layout. Spacious, centred, TikTok-style top;
// compact 3-tile folder row (not tall bars); Saved jobs + Settings as
// full rows; folders open by REPLACING the body, with a "Profile" back
// link, rather than expanding inline underneath the tiles the way the
// old layout did.
//
// Structural colours (page/card backgrounds, hairline borders) stay
// this app's own dark palette rather than the spec text's literal
// #FFFFFF card -- the user's own reference screenshot for this exact
// screen is dark, the same call made for every dark rebuild this
// session. Every PINNED accent hex (avatar, tag pills, folder icon
// colours, the blue privacy note) is used exactly as given regardless.
// The one deliberate exception: the avatar is a SOLID #185FA5 fill
// with white text rather than the spec text's light-pill claim --
// that's what the reference screenshot itself actually shows, and it's
// built from a hex the spec already pinned, not an invented colour.
export default function ProfilePanel({ userId, ownView = true }: { userId?: string; ownView?: boolean }) {
  const { user: authUser, refreshUser } = useAuth()
  const router = useRouter()
  const profileId = userId || authUser?.id
  const isOwn = ownView && profileId === authUser?.id

  const [profile, setProfile] = useState<any>(authUser)
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [verified, setVerified] = useState<any[]>([])
  const [quals, setQuals] = useState<any[]>([])
  const [experience, setExperience] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // TikTok-style now, not a navigate-away screen: the tabs stay put,
  // this just tracks which one is active. Always has a value -- there
  // is no "closed" state, same as TikTok's own profile always having
  // one of Posts/Private/Liked selected.
  const [folder, setFolder] = useState<Folder>('verified')
  const [editingBio, setEditingBio] = useState(false)
  const [addingExperience, setAddingExperience] = useState(false)
  const [addingQual, setAddingQual] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  // getBlockedUsers/unblockUser and the "Blocked accounts" list in
  // Settings already existed -- its own empty state even said "Block
  // someone from their profile," but nothing on a profile actually
  // could. This is that missing entry point.
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blockedNotice, setBlockedNotice] = useState(false)

  const load = () => {
    if (!profileId) return
    // profile used to stay pinned to its initial useState(authUser)
    // value whenever isOwn was false -- viewing someone else's profile
    // never actually fetched THEIR name/avatar/bio, so the header kept
    // showing the viewer's own identity while everything below
    // (verified work, posts) was correctly the other person's. Real
    // fetch now runs on every load, own profile or not.
    if (isOwn) setProfile(authUser)
    else getPublicStudentProfile(profileId).then(({ data }) => setProfile(data || null))
    getFollowCounts(profileId).then(setCounts)
    getVerifiedWorkForProfile(profileId).then(({ data }) => { setVerified(data || []); setLoading(false) })
    getSelfQualifications(profileId).then(({ data }) => setQuals(data || []))
    getExperienceEntries(profileId).then(({ data }) => setExperience(data || []))
    getMyPosts(profileId).then(({ data }) => setPosts(data || []))
    if (isOwn) getSavedOpportunities(profileId).then(({ data }) => setSaved(data || []))
  }
  useEffect(load, [profileId, isOwn])

  // "Needs more detail" -- a title line under the name, same logic as
  // planned for the Verified Skill Profile: organisation name if
  // they're in one, "Student" if under 18 and not (so the profile
  // still reads as a real person's page, not blank), nothing at all
  // if 18+ and independent. Own-profile only -- getMyOrganisationInfo
  // needs the org's own RLS-visible id, which is only reliably known
  // here for the signed-in viewer's own profile.
  useEffect(() => {
    if (!isOwn || !profile?.organisation_id) { setOrgName(null); return }
    getMyOrganisationInfo(profile.organisation_id).then(({ data }) => setOrgName(data?.name || null))
  }, [isOwn, profile?.organisation_id])

  if (!profile) return null
  const title = orgName || (!profile.organisation_id && !isAdult(profile.date_of_birth) ? 'Student' : '')

  const folderCount = { verified: verified.length, experience: experience.length, posts: posts.length, saved: saved.length }
  // Skills has no natural "count" the way a list does (it's a level per
  // skill, not items to tally) -- FolderTab just omits the badge for it.

  return (
    // Flat, edge-to-edge, no enclosing card -- exactly how Feed, My
    // Work, Discover and Settings already work. The previous version
    // wrapped the whole screen in a separate #1a1a1a card floating on
    // the #0f0f0f page, which is not a pattern anything else in this
    // app uses -- every other screen just IS the dark surface, cards
    // are for individual rows/tiles inside it, never the whole page.
    // That boxed-card structure is what actually made the profile
    // look like "a square" instead of a real screen: a self-contained
    // box with its own visible corners sitting in the middle of a
    // taller page, not a surface that fills it. Removing the box
    // outright fixes both the look and the leftover-height problem in
    // one move -- there's no card left that needs to be tricked into
    // filling a guessed-at height, content just flows like every other
    // screen here does.
    <div className="relative bg-[var(--app-bg)] min-h-[calc(100vh-56px)] px-4 pt-4 pb-8 text-[var(--app-text)]">
        {/* Settings: a quiet icon in the corner, own view only. Always
            here now -- there's no separate "inside a folder" screen
            to hide it behind any more. */}
        {isOwn && (
          <button
            onClick={() => router.push('/student/settings')}
            aria-label="Settings"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-1)] transition text-[var(--app-text-secondary)]"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        )}

        {!isOwn && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setBlockMenuOpen(v => !v)}
              aria-label="More options"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-1)] transition text-[var(--app-text-secondary)]"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {blockMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBlockMenuOpen(false)} />
                <div className="absolute right-0 top-11 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-lg py-1.5 w-44 z-20">
                  <button
                    onClick={async () => {
                      if (!authUser || !profileId) return
                      setBlocking(true)
                      await blockUser(authUser.id, profileId)
                      setBlocking(false)
                      setBlockMenuOpen(false)
                      setBlockedNotice(true)
                      setTimeout(() => router.back(), 1200)
                    }}
                    disabled={blocking}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-[var(--app-overlay-1)] transition disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" /> {blocking ? 'Blocking…' : `Block ${profile.full_name?.split(' ')[0] || 'this account'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {blockedNotice && (
          <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
            <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-lg px-4 py-2.5 text-[13px] font-semibold">
              Blocked — you won't see each other's posts or profile.
            </div>
          </div>
        )}

        {editingBio && (
          <EditProfileScreen
            profile={profile}
            onDone={async () => { await refreshUser(); setEditingBio(false); load() }}
            onClose={() => setEditingBio(false)}
          />
        )}

        {/* ── 1. Top block -- avatar and name on the left, not centred.
            "It kind of looks similar to TikTok profiles... just make it
            simple, like the way you just made employees [employers] --
            profile is on the left hand side" (direct feedback,
            comparing directly against CandidateDetailPanel's own header,
            same avatar size, same name size, same left alignment). ── */}
        <div className="pt-1">
          <div className="flex items-start gap-4 mb-3">
            <Avatar path={profile.avatar_path} name={profile.full_name} size={80} textSize={26} variant="solid" />
            <div className="min-w-0 flex-1">
              {/* The Feed's own post card already shows this exact tick
                  next to a verified author's name (same "at least one
                  live verified piece of work" rule, via
                  getVerifiedAuthorIds) -- it was never carried over to
                  the profile's own header, so seeing yourself verified
                  on Feed but not on your own profile read as a
                  contradiction. */}
              <p className="flex items-center gap-1.5 text-[22px] font-bold tracking-tight truncate">
                {profile.full_name}
                {verified.length > 0 && <CheckCircle2 className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#0F6E56' }} />}
              </p>
              {profile.username && <p className="text-[13px] text-[var(--app-text-secondary)] mt-0.5">@{profile.username}</p>}
              {title && <p className="text-[12.5px] font-medium mt-1" style={{ color: '#D4551A' }}>{title}</p>}
              <div className="flex items-center gap-3.5 mt-2.5">
                <Stat n={folderCount.verified} label="work" />
                <StatDivider />
                <Stat n={counts.followers} label="followers" />
                <StatDivider />
                <Stat n={counts.following} label="following" />
              </div>
            </div>
          </div>

          {profile.bio && (
            <p className="text-[13.5px] text-[var(--app-text-body)] leading-[1.5] max-w-xl">{profile.bio}</p>
          )}

          {(profile.interest_tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {profile.interest_tags.slice(0, 3).map((t: string) => (
                <span key={t} className="text-[11.5px] font-medium px-3 py-[5px] rounded-full" style={{ backgroundColor: '#E6F1FB', color: '#0C447C' }}>{t}</span>
              ))}
            </div>
          )}
          {isOwn ? (
            <button
              onClick={() => setEditingBio(true)}
              className="mt-3.5 px-6 py-2 rounded-full border border-[var(--app-overlay-3)] text-[13px] font-semibold hover:bg-[var(--app-overlay-2)] active:scale-[0.98] transition"
            >
              Edit profile
            </button>
          ) : (
            <div className="mt-3.5">
              <FollowButton
                profileId={profileId!}
                onChange={isNowFollowing => setCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers + (isNowFollowing ? 1 : -1)) }))}
              />
            </div>
          )}
        </div>

        {/* ── 2. Folders as TikTok-style tabs: Verified, Experience,
            Posts, and (own view only) Saved jobs. Tapping one doesn't
            navigate anywhere -- it swaps the grid below, same screen,
            tabs stay visible, active tab gets an underline. "Tap
            Posts, see your posts. Tap Saved, see what's saved."
            Skills only shows here for someone ELSE's profile now --
            your own skills (leveled + self-reported) live at their own
            destination instead (desktop: "My Skill" in the sidebar;
            phone: a tab inside My Work, see StudentMyWorkPanel.tsx),
            so this row stays 4 tabs either way: verified/experience/
            posts/saved for your own profile, verified/experience/
            posts/skills for a peer's. ── */}
        <div className="grid grid-cols-4 mt-6 border-b border-[var(--app-border)]">
          <FolderTab active={folder === 'verified'} onClick={() => setFolder('verified')} icon={FolderCheck} iconColor="#0F6E56" label="Verified" count={folderCount.verified} />
          <FolderTab active={folder === 'experience'} onClick={() => setFolder('experience')} icon={Briefcase} iconColor="#D4551A" label="Experience" count={folderCount.experience} />
          <FolderTab active={folder === 'posts'} onClick={() => setFolder('posts')} icon={Grid3x3} iconColor="#5A5A5A" label="Posts" count={folderCount.posts} />
          {!isOwn && (
            <FolderTab active={folder === 'skills'} onClick={() => setFolder('skills')} icon={Award} iconColor="#7C3AED" label="Skills" />
          )}
          {isOwn && (
            <FolderTab active={folder === 'saved'} onClick={() => setFolder('saved')} icon={Bookmark} iconColor="#D4551A" label="Saved" count={folderCount.saved} />
          )}
        </div>

        {/* ── 3. The active tab's content, directly below -- no back
            link, nothing to navigate away from. ── */}
        <div className="pt-4">
          <FolderContent
            folder={folder} isOwn={isOwn} loading={loading}
            verified={verified} quals={quals} experience={experience} posts={posts} saved={saved}
            profileId={profileId!} organisationId={profile.organisation_id}
            onChanged={load}
            addingExperience={addingExperience} setAddingExperience={setAddingExperience}
            addingQual={addingQual} setAddingQual={setAddingQual}
          />
        </div>
    </div>
  )
}

// Shared everywhere a profile photo shows: real image if avatar_path
// is set, initials otherwise -- so there's never a broken/empty state,
// just a graceful fallback. Two colour treatments, both built only
// from hex values the specs themselves already pinned (nothing
// invented): 'light' is the original #E6F1FB-on-#185FA5 pill used in
// Settings/Edit-profile rows and everywhere else. 'solid' -- used only
// on the Profile screen's own top block -- is the exact same #185FA5
// as a SOLID fill with white text: the Final Layout Spec v2.0
// reference screenshot shows a solid dark-blue circle there, the
// inverse of the spec text's literal light-pill claim, the same
// "screenshot wins over spec text" call made for every dark rebuild
// this session -- just applied to one element this time, not the
// whole screen, since the tag pills right below it in that same
// screenshot DO match the spec text's light pill exactly.
export function Avatar({ path, name, size, textSize, variant = 'light' }: { path?: string | null; name?: string; size: number; textSize: number; variant?: 'light' | 'solid' }) {
  const url = useAvatarUrl(path)
  if (url) {
    return (
      <img
        src={url} alt="" width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const colors = variant === 'solid' ? { backgroundColor: '#185FA5', color: '#FFFFFF' } : { backgroundColor: '#E6F1FB', color: '#185FA5' }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: textSize, ...colors }}
    >
      {initials(name)}
    </div>
  )
}

// Bumped up from 13.5px -- read too small next to the rest of the
// profile. Still a compact "n label" pair read horizontally, no
// divider lines around the whole row (just the thin "|" between each
// stat, see StatDivider).
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <p className="text-[15px] leading-none">
      <span className="font-bold">{n}</span> <span className="text-[var(--app-text-secondary)]">{label}</span>
    </p>
  )
}

// A real 1px bar, not a "|" glyph -- the character itself renders
// thicker than 1px at this size/weight in most fonts, which is what
// "the line is too thick" actually was. This gives exact control over
// its width regardless of font.
function StatDivider() {
  return <span className="w-px h-3 flex-shrink-0" style={{ backgroundColor: 'var(--app-text)', opacity: 0.15 }} />
}

// TikTok-style tab, not a navigate-away tile -- icon, label, count,
// and an underline that only appears on the active one. No card box
// around it, per direct feedback.
// Bumped up a size from the original compact treatment -- icon
// 16px→20px, label 12px→13px, underline 2px→3px, more vertical
// padding -- per direct feedback that the tab row read as too small
// next to everything else on the page.
function FolderTab({ active, onClick, icon: Icon, iconColor, label, count }: {
  active: boolean; onClick: () => void; icon: any; iconColor: string; label: string; count?: number
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 pb-3 border-b-[3px] transition"
      style={{ borderColor: active ? '#D4551A' : 'transparent' }}
    >
      <Icon className="w-5 h-5" style={{ color: active ? iconColor : '#666' }} />
      <span>
        <span className={`text-[13px] font-semibold ${active ? 'text-[var(--app-text)]' : 'text-[var(--app-text-secondary)]'}`}>{label}</span>
        {count !== undefined && <span className="text-[11px] text-[var(--app-text-secondary)]"> · {count}</span>}
      </span>
    </button>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <Icon className="w-7 h-7 text-[var(--app-text-quaternary)] mb-2.5" />
      <p className="font-semibold text-[13px] mb-1">{title}</p>
      <p className="text-[12px] text-[var(--app-text-tertiary)]">{hint}</p>
    </div>
  )
}

// ── 3. The active tab's content -- TikTok-style, no back link and no
// repeated header (the tab itself already shows what's selected).
// Same component for all four, just the grid inside changes.
function FolderContent({
  folder, isOwn, loading, verified, quals, experience, posts, saved, profileId, organisationId, onChanged,
  addingExperience, setAddingExperience, addingQual, setAddingQual,
}: {
  folder: Folder; isOwn: boolean; loading: boolean
  verified: any[]; quals: any[]; experience: any[]; posts: any[]; saved: any[]
  profileId: string; organisationId?: string | null; onChanged: () => void
  addingExperience: boolean; setAddingExperience: (v: boolean | ((v: boolean) => boolean)) => void
  addingQual: boolean; setAddingQual: (v: boolean | ((v: boolean) => boolean)) => void
}) {
  const [openWork, setOpenWork] = useState<any | null>(null)
  const [openExperience, setOpenExperience] = useState<any | null>(null)

  return (
    <div>
      {folder === 'verified' && (
        loading ? <p className="text-[13px] text-[var(--app-text-tertiary)]">Loading…</p> : (verified.length === 0 && quals.length === 0) ? (
          <EmptyState icon={FolderCheck} title="Nothing here yet" hint="It'll show up here the moment a tutor verifies your first piece of work" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[10px]">
              {verified.map(v => (
                <button key={v.id} onClick={() => setOpenWork(v)} className="text-left bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-[14px] hover:border-[var(--app-overlay-3)] transition">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: '#E1F5EE' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#0F6E56' }} />
                  </span>
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{v.submissions?.work_items?.title}</p>
                  <p className="text-[12px] mt-1" style={{ color: '#4ade80' }}>
                    Verified · {new Date(v.verified_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </button>
              ))}
              {quals.map(q => (
                <div key={q.id} className="rounded-xl p-[14px] border border-dashed relative" style={{ borderColor: '#8A8A8A' }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 bg-[var(--app-overlay-1)]">
                    <FilePlus className="w-4 h-4" style={{ color: '#8A8A8A' }} />
                  </span>
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{q.title}</p>
                  <p className="text-[12px] mt-1">
                    <span>Self-added certificate</span><span style={{ color: '#8A8A8A' }}> · not verified by LERN</span>
                  </p>
                  {isOwn && (
                    <button onClick={async () => { await deleteSelfQualification(q.id); onChanged() }} className="absolute top-2.5 right-2.5 text-[var(--app-text-tertiary)] hover:text-danger-text transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isOwn && (
              <button onClick={() => setAddingQual(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1 mt-3">
                {addingQual ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add a self-added certificate
              </button>
            )}
            {addingQual && <div className="mt-3"><AddQualForm profileId={profileId} onAdded={() => { setAddingQual(false); onChanged() }} /></div>}
          </>
        )
      )}

      {folder === 'experience' && (
        <>
          {experience.length === 0 ? (
            <EmptyState icon={Briefcase} title="Nothing added yet" hint="Work placements, volunteering, part-time work — anything real-world" />
          ) : (
            <div className="grid grid-cols-2 gap-[10px]">
              {experience.map(e => (
                <div key={e.id} className="relative">
                  <button
                    onClick={() => setOpenExperience(e)}
                    className="w-full text-left bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-[14px] hover:border-[var(--app-overlay-3)] transition"
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: '#E6F1FB' }}>
                      <Briefcase className="w-4 h-4" style={{ color: '#D4551A' }} />
                    </span>
                    <p className="text-[13px] font-semibold leading-snug line-clamp-2">{e.title}</p>
                    <p className="text-[12px] text-[var(--app-text-secondary)] mt-1 truncate">{e.organisation || 'Work experience'}</p>
                    {(e.employment_type || e.start_date) && (
                      <p className="text-[11px] text-[var(--app-text-tertiary)] mt-1 truncate">
                        {[EMPLOYMENT_TYPE_LABEL[e.employment_type] || e.employment_type, formatDateRange(e)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                  {isOwn && (
                    <button onClick={async () => { await deleteExperienceEntry(e.id); onChanged() }} className="absolute top-2.5 right-2.5 text-[var(--app-text-tertiary)] hover:text-danger-text transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {isOwn && (
            <button onClick={() => setAddingExperience(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1 mt-3">
              {addingExperience ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add experience
            </button>
          )}
          {addingExperience && <div className="mt-3"><AddExperienceForm profileId={profileId} onAdded={() => { setAddingExperience(false); onChanged() }} /></div>}
        </>
      )}

      {folder === 'posts' && (
        posts.length === 0 ? (
          <EmptyState icon={Grid3x3} title="No posts yet" hint="Tap + to share something" />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map(p => <PostThumb key={p.id} post={p} canDelete={isOwn} onDeleted={onChanged} />)}
          </div>
        )
      )}

      {folder === 'skills' && (
        <SkillsFolderContent profileId={profileId} organisationId={organisationId} isOwn={isOwn} />
      )}

      {folder === 'saved' && (
        <>
          {saved.length === 0 ? (
            <EmptyState icon={Bookmark} title="Nothing saved yet" hint="Bookmark a job from Discover to save it here" />
          ) : (
            <div className="space-y-2 mb-4">
              {saved.map(s => (
                <div key={s.id} className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-[14px] py-3 flex items-center gap-2.5">
                  <Bookmark className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#D4551A' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{s.opportunity?.title}</p>
                    <p className="text-[12px] text-[var(--app-text-secondary)] truncate">{s.opportunity?.employer?.full_name || 'An employer'} · saved {daysAgo(s.created_at)} days ago</p>
                  </div>
                  <a href="/student/discover" className="flex items-center gap-1 text-[13px] font-semibold flex-shrink-0" style={{ color: '#D4551A' }}>
                    Apply <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={async () => { await unsaveOpportunity(profileId, s.opportunity_id); onChanged() }}
                    aria-label="Remove from saved" className="text-[var(--app-text-tertiary)] hover:text-danger-text transition flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-lg px-[12px] py-[10px] flex items-start gap-2" style={{ backgroundColor: '#E6F1FB' }}>
            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
            <p className="text-[12px]" style={{ color: '#0C447C' }}>Saved jobs is private. Only you can see it. Employers see only your Verified, Experience and Posts folders.</p>
          </div>
        </>
      )}

      {openWork && <VerifiedWorkDetail work={openWork} onClose={() => setOpenWork(null)} />}
      {openExperience && <ExperienceDetail entry={openExperience} onClose={() => setOpenExperience(null)} />}
    </div>
  )
}

// Same "tap it, see the whole thing" pattern as VerifiedWorkDetail --
// the compact tile only has room for title/org/a short meta line, the
// full employment type, date range, location and description (the
// actual "more detail" asked for) live here.
function ExperienceDetail({ entry, onClose }: { entry: any; onClose: () => void }) {
  const range = formatDateRange(entry)
  return createPortal((
    <div className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-[var(--app-bg)]/95 backdrop-blur border-b border-[var(--app-border)]">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-2)] transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4 pb-10 lg:max-w-2xl lg:mx-auto">
        <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl p-5">
          {entry.employment_type && (
            <span className="inline-flex items-center text-[12px] font-semibold px-3 py-1 rounded-full mb-3" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
              {EMPLOYMENT_TYPE_LABEL[entry.employment_type] || entry.employment_type}
            </span>
          )}
          <h1 className="text-[20px] font-bold leading-snug mb-1 text-[var(--app-text)]">{entry.title}</h1>
          {entry.organisation && <p className="text-[14px] text-[var(--app-text-secondary)] mb-2">{entry.organisation}</p>}
          {(range || entry.location) && (
            <p className="text-[12.5px] text-[var(--app-text-tertiary)] mb-4">{[range, entry.location].filter(Boolean).join(' · ')}</p>
          )}
          {entry.description && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wide mb-1.5">What they did</p>
              <p className="text-[14px] text-[var(--app-text)] whitespace-pre-wrap leading-relaxed">{entry.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}

// ── Skills tab -- a compact read of the Skill Wallet, not the full
// evidence-drilldown experience (that stays at /student/skill-wallet,
// own view only -- the route re-derives everything from the VIEWER's
// own session, so it can never show a different student's evidence;
// building that out would be real new RLS surface on
// review_criteria_results nobody's asked for). Cross-org profile views
// correctly render empty here (courses/skills RLS is org-scoped), same
// reason getMyOrganisationInfo above is isOwn-gated -- not a bug.
export function SkillsFolderContent({ profileId, organisationId, isOwn }: { profileId: string; organisationId?: string | null; isOwn: boolean }) {
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [studentSkills, setStudentSkills] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addingSkill, setAddingSkill] = useState(false)
  const [openGoal, setOpenGoal] = useState<any | null>(null)

  const load = () => {
    const calls: Promise<any>[] = [
      organisationId ? getOrgSkillsForStudent(organisationId) : Promise.resolve({ data: [] }),
      getStudentSkills(profileId),
    ]
    // Only fetched for the owner -- RLS has no read path for anyone
    // else to see a skill goal at all (student-own or org-staff only),
    // so this would just come back empty for a peer.
    if (isOwn) calls.push(getMySkillGoals(profileId))
    Promise.all(calls).then(([c, ss, g]) => {
      setCourses((c.data as any) || [])
      setStudentSkills(ss.data || [])
      if (g) setGoals(g.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [profileId, organisationId, isOwn])

  if (loading) return <p className="text-[13px] text-[var(--app-text-tertiary)]">Loading…</p>

  const levelFor = (skillId: string) => studentSkills.find((ss: any) => ss.skill_id === skillId)
  const coursesWithSkills = courses.filter((c: any) => (c.skills || []).length > 0)
  const nothingAtAll = coursesWithSkills.length === 0 && goals.length === 0 && !isOwn

  if (nothingAtAll) {
    return <EmptyState icon={Award} title="No skills yet" hint="Nothing to show here yet." />
  }

  return (
    <div className="space-y-6">
      {coursesWithSkills.length === 0 && isOwn && goals.length === 0 && !addingSkill && (
        <p className="text-[13px] text-[var(--app-text-tertiary)]">Your tutor adds skills to a course — they'll show up here once they have. Or set your own goal below.</p>
      )}

      {coursesWithSkills.map((course: any) => (
        <div key={course.id}>
          <p className="text-[12px] font-semibold text-[var(--app-text-tertiary)] uppercase tracking-wide mb-2">{course.name}</p>
          <div className="space-y-2.5">
            {course.skills.map((skill: any) => {
              const ss = levelFor(skill.id)
              const level = ss?.level || 'not_started'
              const info = LEVEL_INFO[level as keyof typeof LEVEL_INFO]
              return (
                <button
                  key={skill.id}
                  onClick={() => { if (isOwn) router.push('/student/skill-wallet') }}
                  className={`block w-full text-left bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-[14px] transition ${isOwn ? 'hover:border-[var(--app-overlay-3)]' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--app-text)] truncate">{skill.name}</p>
                      {skill.unit_label && <p className="text-[12px] text-[var(--app-text-tertiary)] mt-0.5 truncate">{skill.unit_label}</p>}
                    </div>
                    <span className="text-[11px] font-semibold px-[10px] py-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: info.bg, color: info.text }}>
                      {info.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Self-reported skill goals -- own view only. No institution
          setup needed to start, and no teacher confirm step either:
          being enrolled at a vetted institution is the trust signal.
          Each goal is a real, dated log of check-ins (write-up +
          required evidence each time), not a single one-shot claim --
          "I can see they've been progressing weekly" (direct feedback)
          is exactly what a multi-entry, server-timestamped timeline
          shows that one upload never could. ── */}
      {isOwn && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-[var(--app-text-tertiary)] uppercase tracking-wide">Self-reported</p>
            {!addingSkill && (
              <button onClick={() => setAddingSkill(true)} className="text-[12px] font-semibold text-brand flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add a skill
              </button>
            )}
          </div>
          {addingSkill && (
            <AddSkillGoalForm
              profileId={profileId} organisationId={organisationId}
              onAdded={() => { setAddingSkill(false); load() }}
              onCancel={() => setAddingSkill(false)}
            />
          )}
          {goals.length === 0 && !addingSkill ? (
            <p className="text-[13px] text-[var(--app-text-tertiary)]">A skill you're teaching yourself — set a goal, then check in weekly with what you did and proof of the work.</p>
          ) : (
            <div className="space-y-2.5 mt-2">
              {goals.map((g: any) => {
                const count = g.skill_checkins?.length || 0
                return (
                  <button key={g.id} onClick={() => setOpenGoal(g)} className="block w-full text-left bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-[14px] hover:border-[var(--app-overlay-3)] transition">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-[var(--app-text)] truncate">{g.name}</p>
                      <span className="flex items-center gap-1 text-[11px] font-semibold px-[10px] py-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                        <CheckCircle2 className="w-3 h-3" /> {count} check-in{count === 1 ? '' : 's'}
                      </span>
                    </div>
                    {g.target_date && (
                      <p className="text-[12px] text-[var(--app-text-tertiary)] mt-1">Target: {new Date(g.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {openGoal && (
        <SkillGoalTimeline
          goal={openGoal} canCheckIn studentId={profileId} variant="app"
          onClose={() => setOpenGoal(null)} onCheckedIn={load}
        />
      )}
    </div>
  )
}

function AddSkillGoalForm({ profileId, organisationId, onAdded, onCancel }: {
  profileId: string; organisationId?: string | null; onAdded: () => void; onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) return setError('Name the skill.')
    setSaving(true); setError('')
    const { error: err } = await createSkillGoal(profileId, organisationId || undefined, {
      name: name.trim(), target: target.trim() || undefined, target_date: targetDate || undefined,
    })
    setSaving(false)
    if (err) { setError("Couldn't save — try again."); return }
    onAdded()
  }

  return (
    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2 mb-3">
      <input
        value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Adobe Illustrator" autoFocus
        className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition"
      />
      <textarea
        value={target} onChange={e => setTarget(e.target.value)} rows={2}
        placeholder="What do you want to be able to do by the deadline? (optional)"
        className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition resize-none leading-relaxed"
      />
      <label className="block">
        <span className="block text-[11px] text-[var(--app-text-tertiary)] mb-1">Target date (optional)</span>
        <input
          type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
          className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] outline-none focus:border-brand transition"
        />
      </label>
      <p className="text-[11.5px] text-[var(--app-text-tertiary)]">You'll check in with what you did and proof of the work as you go — nothing to attach yet.</p>
      {error && <p className="text-[12px] text-danger-text">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={!name.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
          {saving ? 'Saving…' : 'Set goal'}
        </button>
        <button onClick={onCancel} disabled={saving} className="px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text-secondary)]">Cancel</button>
      </div>
    </div>
  )
}

// "When I click the work it should open so I can see it" -- tapping a
// verified piece used to do nothing at all. This shows the actual
// submitted content: the written answer/link, and the attached file
// (an image previews inline, anything else is a real download link),
// plus who verified it and against what criteria.
function VerifiedWorkDetail({ work, onClose }: { work: any; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const sub = work.submissions
  const wi = sub?.work_items
  const isImage = sub?.file_type && ['image/png', 'image/jpeg', 'image/webp'].includes(sub.file_type)

  useEffect(() => {
    if (sub?.file_path) getSignedFileUrl('submission-files', sub.file_path).then(({ url }) => setFileUrl(url))
  }, [sub?.file_path])

  return createPortal((
    // z-50 already paints this over the shell's nav (z-30) entirely --
    // this screen is meant to fully replace the visible chrome while
    // open, not sit alongside it. paddingBottom added for the home
    // indicator's own safe area, which nothing here was reserving --
    // matches every other full-screen overlay's convention. Portaled
    // to document.body for the same reason as every other feed/composer
    // modal fixed today -- this renders nested inside main, and a
    // full-screen overlay several levels deep inside a scrolling
    // ancestor is the class of bug that let the bottom nav render over
    // it on some devices.
    <div className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-[var(--app-bg)]/95 backdrop-blur border-b border-[var(--app-border)]">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-2)] transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 pb-10">
        <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl p-5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full mb-3" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
          <h1 className="text-[20px] font-bold leading-snug mb-2 text-[var(--app-text)]">{wi?.title}</h1>
          <p className="text-[12.5px] text-[var(--app-text-secondary)] mb-4">
            Verified by {work.verifier?.full_name || wi?.organisations?.name || 'a reviewer'} · {new Date(work.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {wi?.criteria && (
            <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 mb-4">
              <p className="text-[11px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wide mb-1">Criteria</p>
              <p className="text-[13px] text-[var(--app-text-body)] leading-relaxed">{wi.criteria}</p>
            </div>
          )}

          {sub?.content && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wide mb-1.5">The work</p>
              <p className="text-[14px] text-[var(--app-text)] whitespace-pre-wrap leading-relaxed">{sub.content}</p>
            </div>
          )}

          {sub?.file_path && (
            isImage && fileUrl ? (
              <img src={fileUrl} alt="" className="w-full rounded-lg border border-[var(--app-border)]" />
            ) : (
              <a
                href={fileUrl || '#'} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[13px] font-semibold text-[var(--app-text)] hover:border-[var(--app-overlay-3)] transition"
              >
                <FilePlus className="w-4 h-4 text-[var(--app-text-secondary)] flex-shrink-0" />
                <span className="truncate">{sub.file_path.split('/').pop()}</span>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  ), document.body)
}

// Full-screen, not an inline card -- matches how Instagram/TikTok
// actually do "Edit profile": its own screen, a centred avatar up top,
// each field on its own labelled row with real room to breathe, a
// Cancel/Save header instead of buttons buried at the bottom of a
// cramped box.
// Exported -- Settings' Account section (Display name / Bio /
// Interests / Profile photo rows) reuses this exact same screen
// rather than rebuilding four near-identical forms.
export function EditProfileScreen({ profile, onDone, onClose }: { profile: any; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(profile.full_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [tags, setTags] = useState((profile.interest_tags || []).join(', '))
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatar_path || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  // Tapping "Save" straight after typing in a field (Bio especially --
  // the last one most people edit) removes this whole portal, inputs
  // included, while one is still focused. A native blur/focusout isn't
  // guaranteed to fire when the focused node is removed like that,
  // which left StudentShell's/OrgShell's own focusin/focusout tracking
  // stuck with body.keyboard-open still set -- permanently hiding the
  // bottom nav (reads as a blank bar-shaped gap where it should be)
  // until something else happened to reset it.
  useEffect(() => {
    return () => { document.body.classList.remove('keyboard-open') }
  }, [])

  const pickPhoto = () => photoRef.current?.click()

  const onPhotoChosen = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setPhotoError('Choose an image file.')
    setUploadingPhoto(true); setPhotoError('')
    const { path, error } = await uploadAvatar(profile.id, file)
    setUploadingPhoto(false)
    if (error) return setPhotoError(error.message || 'Upload failed — try again.')
    setAvatarPath(path)
  }

  const removePhoto = async () => {
    setUploadingPhoto(true); setPhotoError('')
    const { error } = await removeAvatar(profile.id, avatarPath)
    setUploadingPhoto(false)
    if (error) return setPhotoError(error.message || "Couldn't remove that — try again.")
    setAvatarPath(null)
  }

  const save = async () => {
    setError('')
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
    if (cleanUsername && !/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
      return setError('Username: 3–20 characters, lowercase letters, numbers, dots or underscores only.')
    }
    setSaving(true)
    if (cleanUsername && cleanUsername !== (profile.username || '')) {
      const { available, error: checkErr } = await isUsernameAvailable(cleanUsername, profile.id)
      if (checkErr) { setSaving(false); return setError(checkErr.message) }
      if (!available) { setSaving(false); return setError('That username is taken — try another.') }
    }
    // Was discarding both results before -- a failed save (network,
    // RLS, anything) still closed the sheet via onDone() as if the
    // name/bio/tags had actually changed, with nothing telling the
    // user their edit never landed.
    const [{ error: profileErr }, { error: bioErr }] = await Promise.all([
      updateUserProfile(profile.id, { full_name: name.trim(), username: cleanUsername || null }),
      updateProfileBioTags(profile.id, bio.trim(), tags.split(',').map((t: string) => t.trim()).filter(Boolean)),
    ])
    setSaving(false)
    const saveError = profileErr || bioErr
    if (saveError) { setError(saveError.message || "Couldn't save — try again."); return }
    forceBlur()
    onDone()
  }

  // Tapping Cancel/Save moves focus to that button, not out of the page
  // entirely -- an on-screen keyboard doesn't always dismiss just
  // because a plain button was tapped, especially inside a portal. This
  // only forces the actual blur (which fires StudentShell's/OrgShell's
  // own focusout, starting its fixed un-hide delay); it deliberately
  // does NOT also clear keyboard-open here itself -- an earlier version
  // did, on the theory that closing this screen is a safe moment to
  // reveal the nav immediately, and that was itself the bug: the
  // keyboard can still be mid-animation when this screen unmounts, so
  // revealing the nav that early showed it against a viewport that
  // hadn't resized back yet.
  const forceBlur = () => { (document.activeElement as HTMLElement | null)?.blur() }
  const handleCancel = () => { forceBlur(); onClose() }

  return createPortal((
    <div className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[var(--app-bg)]/95 backdrop-blur border-b border-[var(--app-border)]">
        <button onClick={handleCancel} className="text-[15px] text-[var(--app-text-secondary)]">Cancel</button>
        <p className="text-[15px] font-semibold text-[var(--app-text)]">Edit profile</p>
        <button onClick={save} disabled={saving || !name.trim()} className="text-[15px] font-semibold text-brand disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6">
        <button onClick={pickPhoto} disabled={uploadingPhoto} className="relative disabled:opacity-60">
          <Avatar path={avatarPath} name={name || profile.full_name} size={96} textSize={32} variant="solid" />
          {/* border-[#0f0f0f] was hardcoded black regardless of theme --
              on a light-mode surface that read as a solid black ring
              punched into the profile photo itself ("the pfp is
              black"). var(--app-bg) matches whatever's actually behind
              it in either theme, so it reads as a clean cutout again. */}
          <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-[var(--app-bg)]">
            <Camera className="w-3.5 h-3.5 text-[var(--app-text)]" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => onPhotoChosen(e.target.files?.[0] || null)} />
        {photoError && <p className="text-[12px] text-danger-text mt-2 text-center px-8">{photoError}</p>}
        <div className="flex items-center gap-4 mt-3">
          <button onClick={pickPhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-brand disabled:opacity-40">
            {uploadingPhoto ? 'Uploading…' : avatarPath ? 'Change photo' : 'Add photo'}
          </button>
          {avatarPath && (
            <button onClick={removePhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-[var(--app-text-secondary)] disabled:opacity-40">
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="px-5 space-y-6 pb-10">
        {error && <p className="text-[13px] text-danger-text">{error}</p>}
        <EditField label="Name" value={name} onChange={setName} placeholder="Your name" />
        <EditField
          label="Username" value={username} onChange={setUsername} placeholder="e.g. amara.designs"
          hint="Your handle, shown as @username under your name."
        />
        <EditField
          label="Bio" value={bio} onChange={setBio} multiline maxLength={120}
          placeholder="Aspiring graphic designer · Year 10 · loves branding and illustration"
        />
        <EditField
          label="Interests" value={tags} onChange={setTags}
          placeholder="Up to 3, comma separated — e.g. Design, Illustration, Media"
          hint="Shown as tags on your profile — separate with commas."
        />
      </div>
    </div>
  ), document.body)
}

function EditField({ label, value, onChange, placeholder, hint, multiline, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; multiline?: boolean; maxLength?: number
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-[var(--app-text-secondary)] mb-2">{label}</span>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} maxLength={maxLength}
          className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition resize-none leading-relaxed"
        />
      ) : (
        <input
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition"
        />
      )}
      {hint && <span className="block text-[12px] text-[var(--app-text-tertiary)] mt-1.5">{hint}</span>}
    </label>
  )
}

function AddExperienceForm({ profileId, onAdded }: { profileId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = "w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition"

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true); setError('')
    // Was discarding the error and closing the form regardless before --
    // a failed save silently threw away what was just typed.
    const { error: err } = await addExperienceEntry(profileId, {
      title: title.trim(),
      organisation: organisation.trim() || undefined,
      employment_type: employmentType || undefined,
      location: location.trim() || undefined,
      start_date: startDate || undefined,
      end_date: isCurrent ? undefined : (endDate || undefined),
      is_current: isCurrent,
      description: description.trim() || undefined,
    } as any)
    setSaving(false)
    if (err) { setError("Couldn't save — try again."); return }
    onAdded()
  }

  return (
    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Saturday job at a local print shop" className={inputCls} />
      <input value={organisation} onChange={e => setOrganisation(e.target.value)} placeholder="Who with — a business, or a person (optional)" className={inputCls} />
      <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={inputCls} style={{ color: employmentType ? undefined : '#555' }}>
        <option value="">Type (optional)</option>
        {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" className={inputCls} />
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="block text-[11px] text-[var(--app-text-tertiary)] mb-1">Started</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </label>
        <label className="flex-1">
          <span className="block text-[11px] text-[var(--app-text-tertiary)] mb-1">Ended</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isCurrent} className={`${inputCls} disabled:opacity-40`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-[var(--app-text-secondary)] cursor-pointer">
        <input type="checkbox" checked={isCurrent} onChange={e => setIsCurrent(e.target.checked)} /> I still do this
      </label>
      <textarea
        value={description} onChange={e => setDescription(e.target.value)} rows={3}
        placeholder="What did you actually do? Responsibilities, what you learned (optional)"
        className={`${inputCls} resize-none leading-relaxed`}
      />
      {error && <p className="text-[12px] text-danger-text">{error}</p>}
      <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function AddQualForm({ profileId, onAdded }: { profileId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true); setError('')
    let file_path: string | undefined
    if (file) {
      const { path } = await uploadSelfQualificationFile(profileId, file)
      if (path) file_path = path
    }
    // Was discarding the error and closing the form regardless before --
    // a failed save silently threw away what was just typed/attached.
    const { error: err } = await addSelfQualification(profileId, { title: title.trim(), issuer: issuer.trim() || undefined, file_path })
    setSaving(false)
    if (err) { setError("Couldn't save — try again."); return }
    onAdded()
  }

  return (
    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Level 2 Food Hygiene Certificate" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Issued by (optional)" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[var(--app-text-secondary)] hover:text-brand transition">
        {file ? file.name : 'Attach a file (optional)'}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      {error && <p className="text-[12px] text-danger-text">{error}</p>}
      <div>
        <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function PostThumb({ post, canDelete, onDeleted }: { post: any; canDelete: boolean; onDeleted: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setUrl(url))
  }, [post.image_path, post.video_path])

  const remove = async () => { await deletePost(post.id); onDeleted() }

  // Each reaction the post has, as its emoji and a count, most used first.
  const counts = new Map<string, number>()
  for (const r of post.post_reactions || []) counts.set(r.reaction, (counts.get(r.reaction) || 0) + 1)
  const reactionRow = [...counts.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div>
    <div className="relative aspect-square bg-[var(--app-surface-2)] rounded-lg overflow-hidden group">
      {post.video_path && url ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2">
          {post.video_path
            ? <Play className="w-6 h-6 text-[var(--app-text-quaternary)]" />
            : <p className="text-[11px] text-[var(--app-text-tertiary)] line-clamp-4">{post.content}</p>}
        </div>
      )}
      {canDelete && (
        <button
          onClick={remove}
          aria-label="Delete post"
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/55 rounded-full flex items-center justify-center z-10"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
    {reactionRow.length > 0 && (
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 px-0.5 text-[12px] font-semibold text-[var(--app-text-secondary)]">
        {reactionRow.map(([key, n]) => (
          <span key={key} className="whitespace-nowrap">{STICKER_OPTIONS.find(s => s.key === key)?.emoji} {n}</span>
        ))}
      </div>
    )}
    </div>
  )
}
