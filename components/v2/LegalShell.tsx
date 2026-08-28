'use client'

import Link from 'next/link'
import Logo from '@/components/v2/Logo'
import { ArrowLeft } from 'lucide-react'

// Reachable from settings and sign-up without being logged in — no
// RoleGate, no shell chrome tied to a role.
export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 lg:px-10 py-6">
        <Logo />
        <Link href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-6 pb-20">
        <h1 className="text-2xl font-bold text-ink mb-6">{title}</h1>
        <div className="space-y-4 text-[14px] text-ink-body leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">
          {children}
        </div>
      </main>
    </div>
  )
}
