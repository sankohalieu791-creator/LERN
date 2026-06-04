'use client'

import { useState } from 'react'

interface ProfileTabsProps {
  isOwnProfile: boolean
  children: React.ReactNode
}

export default function ProfileTabs({ isOwnProfile, children }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState('posts')

  const tabs = ['posts', 'projects', 'certificate', 'enrolled']

  if (!isOwnProfile) {
    tabs.push('feedback')
  }

  return (
    <div>
      {/* TAB NAVIGATION */}
      <div className="flex border-b border-[rgba(124,58,237,0.1)] sticky top-20 bg-[#0a0a0a] z-30">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === tab
                ? 'text-white border-[#00D9FF]'
                : 'text-[#888] border-transparent hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="p-6">
        {activeTab === 'posts' && <div>Posts coming soon</div>}
        {activeTab === 'projects' && <div>Projects will display here</div>}
        {activeTab === 'certificate' && <div>Certificates will display here</div>}
        {activeTab === 'enrolled' && <div>Enrolled courses will display here</div>}
        {activeTab === 'feedback' && <div>Feedback will display here</div>}
      </div>
    </div>
  )
}
