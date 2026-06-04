'use client'

import Link from 'next/link'
import { ArrowRight, Users, BookOpen, Award } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/feed')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin">
          <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-[#FF6B2B] rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HERO */}
      <section className="min-h-screen flex items-center justify-center px-4 py-20 bg-gradient-to-b from-[rgba(124,58,237,0.1)] to-transparent">
        <div className="max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Learn Modern Skills<br />
            <span className="bg-gradient-to-r from-[#FF6B2B] via-[#E91E8C] to-[#7C3AED] bg-clip-text text-transparent">
              Build Real Projects
            </span>
          </h1>

          <p className="text-xl text-[#888] mb-8 max-w-2xl mx-auto">
            Free platform where young people learn from real instructors, build real projects, and get verified skills employers respect.
          </p>

          <div className="flex gap-4 justify-center mb-12">
            <Link
              href="/auth/signup"
              className="px-8 py-4 bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold rounded-lg hover:shadow-lg transition flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 border border-[rgba(124,58,237,0.3)] text-white font-bold rounded-lg hover:bg-[rgba(124,58,237,0.1)] transition"
            >
              Sign In
            </Link>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-8 mb-20">
            <div>
              <p className="text-3xl font-bold text-[#FF6B2B]">5K+</p>
              <p className="text-[#888] text-sm mt-2">Students Learning</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#7C3AED]">100+</p>
              <p className="text-[#888] text-sm mt-2">Instructors</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#00D9FF]">500+</p>
              <p className="text-[#888] text-sm mt-2">Courses</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-16 text-center">Why LERN?</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-xl p-8">
              <BookOpen className="w-12 h-12 text-[#FF6B2B] mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">Learn Real Skills</h3>
              <p className="text-[#888]">Modern curriculum taught by professionals. Not outdated theory.</p>
            </div>

            <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-xl p-8">
              <Users className="w-12 h-12 text-[#7C3AED] mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">Build Real Projects</h3>
              <p className="text-[#888]">Create actual projects. Build a portfolio employers love.</p>
            </div>

            <div className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-xl p-8">
              <Award className="w-12 h-12 text-[#00D9FF] mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">Get Verified</h3>
              <p className="text-[#888]">Earn verified skills. Proof you can actually do the work.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-[rgba(255,107,43,0.1)] to-[rgba(124,58,237,0.1)] border-y border-[rgba(124,58,237,0.1)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Learning?</h2>
          <p className="text-[#888] mb-8">Join thousands of students building real skills on LERN.</p>
          <Link
            href="/auth/signup"
            className="inline-block px-8 py-4 bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold rounded-lg hover:shadow-lg transition"
          >
            Sign Up Now
          </Link>
        </div>
      </section>
    </div>
  )
}
