'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateUserProfile } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { Camera, ChevronLeft, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'

export default function EditProfilePage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    username: '',
    title: '',
    bio: '',
    location: '',
    phone: '',
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [skills,     setSkills]     = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    if (!user) return
    setForm({
      username: user.username         || '',
      title:    user.title            || '',
      bio:      user.bio              || '',
      location: user.work_description || '',
      phone:    user.phone_number     || '',
    })
    setAvatarPreview(user.avatar_url || null)
    setSkills(user.skills || [])
  }, [user])

  const addSkill = () => {
    const s = skillInput.trim()
    if (!s || skills.includes(s)) { setSkillInput(''); return }
    setSkills(prev => [...prev, s])
    setSkillInput('')
  }
  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))

  const handleAvatarChange = async (file: File) => {
    if (!user) return
    // Show preview immediately
    setAvatarPreview(URL.createObjectURL(file))
    setUploadingAvatar(true)
    setError('')
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '0' })
      if (uploadErr) throw uploadErr

      // Add cache-bust timestamp so the browser fetches the new image
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const bustedUrl = `${publicUrl}?v=${Date.now()}`

      const { error: saveErr } = await updateUserProfile(user.id, { avatar_url: bustedUrl })
      if (saveErr) throw saveErr

      setAvatarPreview(bustedUrl)
      await refreshUser()
    } catch (e: any) {
      setError(e.message || 'Failed to upload photo')
      // Revert preview on error
      setAvatarPreview(user.avatar_url || null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const { error: err } = await updateUserProfile(user.id, {
        username:         form.username,
        title:            form.title,
        bio:              form.bio,
        work_description: form.location,
        phone_number:     form.phone,
        skills,
      })
      if (err) throw err
      await refreshUser()
      router.back()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const initial = user?.username?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="min-h-screen bg-[#0f0f0f] theme-bg pb-24">

      {/* HEADER */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] theme-border sticky top-0 bg-[#0f0f0f] theme-bg z-10">
        <Link href="/profile/me" className="text-[#888] hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white theme-text-1 font-bold text-lg">Edit Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar}
          className="text-[#FF6B2B] font-semibold text-sm disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* AVATAR */}
      <div className="flex flex-col items-center py-7 border-b border-[rgba(255,255,255,0.07)] theme-border">
        <div className="relative">
          <Avatar url={avatarPreview} size={96} />
          {/* Spinning overlay while uploading */}
          {uploadingAvatar && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 bg-[#FF6B2B] rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingAvatar}
          className="text-[#FF6B2B] text-sm mt-2.5 font-semibold disabled:opacity-50"
        >
          {uploadingAvatar ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
        />
      </div>

      {/* FIELDS */}
      <div className="px-4 pt-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Field label="Username">
          <input value={form.username} onChange={set('username')} placeholder="your_username" className={inputCls} />
        </Field>
        {user?.account_type !== 'student' && (
          <Field label="Title">
            <input value={form.title} onChange={set('title')} placeholder="e.g. Frontend Developer" className={inputCls} />
          </Field>
        )}
        <Field label="Bio">
          <textarea value={form.bio} onChange={set('bio')} placeholder="Tell people about yourself…" rows={3} className={`${inputCls} resize-none`} />
        </Field>
        <Field label="Skills">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs font-semibold bg-[#1e1e1e] theme-card text-[#aaa] theme-text-2 border border-[rgba(255,255,255,0.08)] theme-border pl-2.5 pr-1.5 py-1 rounded-full">
                {s}
                <button type="button" onClick={() => removeSkill(s)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.1)]">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill() } }}
            onBlur={addSkill}
            placeholder="Type a skill and press Enter"
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input value={form.location} onChange={set('location')} placeholder="London, UK" className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={set('phone')} placeholder="+44 7700 900123" type="tel" className={inputCls} />
        </Field>
        <Field label="Email">
          <input value={user?.email ?? ''} readOnly className={`${inputCls} opacity-40 cursor-not-allowed`} />
          <p className="text-[#444] text-xs mt-1.5">Email can't be changed here.</p>
        </Field>
      </div>

      {/* SAVE */}
      <div className="px-4 mt-8">
        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar}
          className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : 'Save Changes'
          }
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-[#1a1a1a] theme-input border border-[rgba(255,255,255,0.08)] theme-border rounded-xl px-4 py-3 text-white theme-text-1 text-sm placeholder-[#333] outline-none focus:border-[rgba(255,255,255,0.2)] transition'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[#555] theme-text-2 text-xs font-semibold mb-1.5">{label}</label>
      {children}
    </div>
  )
}
