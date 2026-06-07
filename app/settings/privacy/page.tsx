'use client'

import Link from 'next/link'
import { ChevronLeft, Shield } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Who we are',
    body: 'LERN is a live social learning platform that connects students with instructors, coaches, mentors and professors worldwide. We are committed to protecting your personal information and being transparent about how we use it.',
  },
  {
    title: 'What we collect',
    body: 'We collect information you provide directly — such as your name, email address, profile photo, and any content you post (videos, comments, messages). We also collect limited usage data (pages visited, session duration) solely to improve the app experience.',
  },
  {
    title: 'How we use your data',
    body: 'Your data is used to operate the platform: display your profile, deliver notifications, personalise your feed, and allow instructors and students to connect. We do not use your data for advertising profiling or behavioural tracking beyond what is necessary to run the service.',
  },
  {
    title: 'We do not sell or share your data',
    body: 'LERN does not sell, rent, or share your personal information with any third party for their marketing purposes. Full stop. The only data shared with third parties is what is strictly required to run the service (e.g. Supabase for database hosting, Agora for real-time audio in virtual classrooms).',
  },
  {
    title: 'Third-party services',
    body: 'We use a small number of trusted infrastructure providers:\n• Supabase — database and authentication (EU data centres)\n• Agora — real-time audio for virtual classrooms\n• Vercel — hosting and edge delivery\n\nEach provider operates under their own privacy policy and GDPR / data processing agreements.',
  },
  {
    title: 'Your rights',
    body: 'You have the right to access, correct or delete your personal data at any time. You can delete your account from Settings → Account & security. To request a full data export or erasure, contact us at privacy@lern.app and we will respond within 30 days.',
  },
  {
    title: 'Data retention',
    body: 'We retain your data for as long as your account is active. When you delete your account, your profile, posts, and messages are permanently removed within 30 days. Aggregate, anonymised analytics may be retained indefinitely.',
  },
  {
    title: 'Children',
    body: 'LERN is intended for users aged 13 and over. We do not knowingly collect personal information from children under 13. If you believe a child has created an account, please contact us so we can remove it promptly.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update this policy from time to time. When we do, we will notify you via the app and update the date below. Continued use of LERN after changes constitutes acceptance of the updated policy.',
  },
  {
    title: 'Contact us',
    body: 'For any privacy-related questions or requests, reach us at privacy@lern.app. We aim to respond within 5 business days.',
  },
]

export default function PrivacyPage() {
  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.07)] bg-[#0f0f0f]">
        <Link href="/settings" className="text-[#888] hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white font-bold text-lg">Privacy &amp; Policy</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

        {/* Hero */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Your privacy matters</p>
            <p className="text-[#555] text-xs mt-0.5">Last updated: June 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          {SECTIONS.map((s, i) => (
            <div key={i}>
              <p className="text-white font-bold text-sm mb-2">{s.title}</p>
              <p className="text-[#666] text-[13px] leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.07)]">
          <p className="text-[#333] text-xs text-center">© 2026 LERN · privacy@lern.app</p>
        </div>
      </div>
    </div>
  )
}
