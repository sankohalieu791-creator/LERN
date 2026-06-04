'use client'

import { Radio } from 'lucide-react'
import Link from 'next/link'

export default function LivePage() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center pb-24 px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center mb-5">
        <Radio className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-white text-2xl font-bold mb-2">Live</h1>
      <p className="text-[#555] text-sm text-center mb-8 max-w-xs leading-relaxed">
        No live sessions right now. When instructors go live, you'll see them here.
      </p>
      <Link
        href="/feed"
        className="bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 px-8 rounded-full text-sm"
      >
        Browse the feed
      </Link>
    </div>
  )
}
