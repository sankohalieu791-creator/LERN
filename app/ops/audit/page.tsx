'use client'

import { useEffect, useState } from 'react'
import { getAdminAuditLog } from '@/lib/supabase'
import { ScrollText } from 'lucide-react'

const ACTION_LABEL: Record<string, string> = {
  employer_approved: 'Approved employer',
  employer_rejected: 'Rejected employer',
  employer_more_info_requested: 'Requested more info from employer',
  report_restored: 'Restored a post',
  report_removed: 'Removed a post',
  report_escalated: 'Escalated a report to a safeguarding concern',
  concern_logged: 'Logged a safeguarding concern',
  concern_status_changed: 'Changed a concern\'s status',
}

// Build Spec: Internal Ops Tool v1.0 -- "Every decision across the
// tool is logged with who made it and when. Not editable after the
// fact." This just reads admin_audit_log; nothing on this page can
// change a row (see block_update_delete() on the table itself).
export default function OpsAuditPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  useEffect(() => { getAdminAuditLog(200).then(({ data }) => setRows(data || [])) }, [])

  return (
    <div className="max-w-2xl">
      <p className="text-[22px] font-bold text-ink mb-1">Audit log</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Every decision across the tool, unchangeable — who, what, and when.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><ScrollText className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink">Nothing logged yet</p>
        </div>
      ) : (
        <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle">
          {rows.map(a => (
            <div key={a.id} className="px-5 py-3.5">
              <p className="text-[13.5px] text-ink"><span className="font-semibold">{a.actor_email}</span> — {ACTION_LABEL[a.action] || a.action}</p>
              {a.detail && <p className="text-[12.5px] text-ink-tertiary mt-0.5">{a.detail}</p>}
              <p className="text-[11px] text-ink-quaternary mt-1">{new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
