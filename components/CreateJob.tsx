'use client'

import { useState } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import { createJob } from '@/lib/supabase'

const JOB_TYPES = ['job', 'internship', 'apprenticeship', 'part-time', 'contract', 'freelance']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  )
}

export default function CreateJob({
  instructorId,
  onCreated,
  onClose,
}: {
  instructorId: string
  onCreated: (job: any) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: '',
    company: '',
    type: 'job',
    salary: '',
    location: '',
    description: '',
    requirements: '',
    apply_link: '',
    tags: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { data, error: err } = await createJob({
      instructor_id: instructorId,
      title: form.title.trim(),
      company: form.company.trim() || undefined,
      type: form.type,
      salary: form.salary.trim() || undefined,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      requirements: form.requirements.trim() || undefined,
      apply_link: form.apply_link.trim() || undefined,
      tags,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] rounded-t-3xl flex flex-col"
        style={{ maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-[rgba(255,255,255,0.07)]">
          <div className="w-10 h-1 bg-[#333] rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
          <h2 className="text-white font-bold text-lg">Post a Job</h2>
          <button onClick={onClose} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
          <Field label="Job Title *">
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Frontend Developer"
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
          </Field>

          <Field label="Company">
            <input value={form.company} onChange={e => set('company', e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
          </Field>

          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map(t => (
                <button key={t} onClick={() => set('type', t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition ${
                    form.type === t
                      ? 'bg-[#FF6B2B]/15 border-[#FF6B2B] text-[#FF6B2B]'
                      : 'bg-[#1e1e1e] border-[rgba(255,255,255,0.07)] text-[#666]'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Salary">
              <input value={form.salary} onChange={e => set('salary', e.target.value)}
                placeholder="e.g. £30k–£40k"
                className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="e.g. Remote"
                className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
            </Field>
          </div>

          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What will this person be doing?"
              rows={3}
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none resize-none" />
          </Field>

          <Field label="Requirements">
            <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)}
              placeholder="Skills and qualifications needed…"
              rows={2}
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none resize-none" />
          </Field>

          <Field label="Apply Link">
            <input value={form.apply_link} onChange={e => set('apply_link', e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
          </Field>

          <Field label="Tags (comma-separated)">
            <input value={form.tags} onChange={e => set('tags', e.target.value)}
              placeholder="React, TypeScript, Remote…"
              className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none" />
          </Field>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Posting…' : 'Post Job'}
          </button>
        </div>
      </div>
    </div>
  )
}
