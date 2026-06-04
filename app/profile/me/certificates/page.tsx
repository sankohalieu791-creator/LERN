'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCertificatesByUser, addCertificate } from '@/lib/supabase'
import { Certificate } from '@/lib/types'
import { X, Upload } from 'lucide-react'

export default function CertificatesPage() {
  const { user } = useAuth()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    issuer: '',
    year: new Date().getFullYear()
  })
  const [certFile, setCertFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchCertificates = async () => {
      if (!user) return

      try {
        const { data } = await getCertificatesByUser(user.id)
        setCertificates(data || [])
      } catch (error) {
        console.error('Error fetching certificates:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCertificates()
  }, [user])

  const handleAddCertificate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.title || !formData.issuer || !certFile) return

    try {
      const url = URL.createObjectURL(certFile)
      await addCertificate(user.id, { ...formData, certificate_url: url })

      setCertificates([...certificates, {
        id: Math.random().toString(),
        user_id: user.id,
        ...formData,
        certificate_url: url,
        created_at: new Date().toISOString()
      }])

      setFormData({ title: '', issuer: '', year: new Date().getFullYear() })
      setCertFile(null)
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding certificate:', error)
    }
  }

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
      {/* HEADER */}
      <div className="bg-[rgba(124,58,237,0.08)] border-b border-[rgba(124,58,237,0.15)] p-6 sticky top-16 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-white text-2xl font-bold">Certificates</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Add Certificate
          </button>
        </div>
      </div>

      {/* CERTIFICATES GRID */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {certificates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888] mb-4">No certificates yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition"
            >
              Upload Your First Certificate
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {certificates.map(cert => (
              <div
                key={cert.id}
                className="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.15)] rounded-lg overflow-hidden hover:border-[rgba(124,58,237,0.3)] transition"
              >
                <div className="aspect-video bg-gradient-to-br from-[#FF6B2B] to-[#7C3AED] flex items-center justify-center">
                  <p className="text-white text-center px-4">{cert.title}</p>
                </div>
                <div className="p-6">
                  <h3 className="text-white font-bold text-lg">{cert.title}</h3>
                  <p className="text-[#888] text-sm">{cert.issuer}</p>
                  <p className="text-[#888] text-xs mt-2">{cert.year}</p>
                  <button className="mt-4 w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white py-2 rounded-lg font-bold hover:shadow-lg transition">
                    View Certificate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD CERTIFICATE MODAL */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-xl w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-2xl font-bold">Add Certificate</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-[rgba(124,58,237,0.2)] rounded-full transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleAddCertificate} className="space-y-4">
              <div>
                <label className="block text-white font-bold mb-2">Certificate Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. React Advanced"
                  className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2">Issuer</label>
                <input
                  type="text"
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  placeholder="e.g. LERN, Coursera"
                  className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white placeholder-[#666] focus:border-[rgba(124,58,237,1)] transition outline-none"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-2">Year</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2 text-white focus:border-[rgba(124,58,237,1)] transition outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-[rgba(124,58,237,0.2)] hover:bg-[rgba(124,58,237,0.3)] text-white py-2 rounded-lg transition"
              >
                <Upload className="w-4 h-4" />
                {certFile ? certFile.name : 'Upload PDF or Image'}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="hidden"
              />

              <button
                type="submit"
                disabled={!formData.title || !formData.issuer || !certFile}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#7C3AED] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                Add to My Certificates
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
