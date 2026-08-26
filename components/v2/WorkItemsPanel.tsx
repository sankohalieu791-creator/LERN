'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getWorkItems, createWorkItem } from '@/lib/supabase'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import type { WorkItem } from '@/lib/types'
import { Plus, X } from 'lucide-react'

type ItemType = 'brief' | 'course' | 'workshop'

const COPY: Record<ItemType, { heading: string; button: string; empty: string }> = {
  brief:    { heading: 'Briefs',   button: 'New brief',   empty: 'No briefs yet.' },
  course:   { heading: 'Courses',  button: 'New course',  empty: 'No courses yet.' },
  workshop: { heading: 'Workshops', button: 'New workshop', empty: 'No workshops yet.' },
}

// Institution "Briefs", provider "Courses", and both roles' "Workshops"
// are the same underlying work_items table, filtered by type — one
// panel, reused three ways, per the layout spec's own build order
// ("Briefs is already built").
export default function WorkItemsPanel({ type }: { type: ItemType }) {
  const { user } = useAuth()
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const copy = COPY[type]

  const load = () => {
    if (!user?.organisation_id) return
    getWorkItems(user.organisation_id).then(({ data }) => {
      setItems((data || []).filter(i => i.type === type))
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, type])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="font-bold text-ink text-[15px]">{copy.heading}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-[#D95E17] transition"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : copy.button}
        </button>
      </div>

      {showCreate && <CreateWorkItemForm type={type} onCreated={() => { setShowCreate(false); load() }} />}

      {loading ? (
        <p className="text-[#8A8373] text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[#8A8373] text-[14px]">{copy.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="border border-[#EDE9E1] rounded-xl px-4 py-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-ink text-[14px]">{item.title}</p>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8373] bg-[#F5F1E8] px-2 py-0.5 rounded-full">
                  {item.visibility}
                </span>
              </div>
              {item.description && <p className="text-[13px] text-[#6B6558] mb-2">{item.description}</p>}
              <p className="text-[12px] text-[#8A8373]">
                <span className="font-semibold">Criteria:</span> {item.criteria}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateWorkItemForm({ type, onCreated }: { type: ItemType; onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!criteria.trim()) return setError('Criteria is required — this is what the tutor checks the work against, and what makes the green tick mean something.')
    if (!user?.organisation_id) return

    setLoading(true)
    const { error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type, title: title.trim(), description: description.trim() || undefined, criteria: criteria.trim(), visibility,
    })
    setLoading(false)
    if (createError) return setError(createError.message)
    setTitle(''); setDescription(''); setCriteria('')
    onCreated()
  }

  return (
    <div className="bg-[#FBF9F4] border border-[#EDE9E1] rounded-xl p-5 mb-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder={type === 'course' ? 'Intro to Web Development' : 'Design a mobile app icon'} autoFocus />
      <TextField label="Description (optional)" value={description} onChange={setDescription} placeholder="What's this about?" />
      <TextField
        label="Criteria — what success looks like"
        value={criteria} onChange={setCriteria}
        placeholder="e.g. Original, scalable to 16px, with a one-paragraph rationale"
        hint="Visible to students too. This is what a tutor checks the work against when they verify it."
      />
      <label className="block mb-5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Visibility</span>
        <div className="flex gap-2">
          {(['private', 'public'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                visibility === v ? 'bg-brand text-white' : 'bg-white border border-[#E2DDD1] text-[#6B6558]'
              }`}
            >
              {v === 'private' ? 'Private — join code only' : 'Public'}
            </button>
          ))}
        </div>
      </label>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create</PrimaryButton>
    </div>
  )
}
