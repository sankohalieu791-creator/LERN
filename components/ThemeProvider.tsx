'use client'

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function ThemeProvider() {
  const { user } = useAuth()

  useEffect(() => {
    const html = document.documentElement
    if (user?.dark_mode === false) {
      html.classList.add('light')
      html.classList.remove('dark')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
    }
  }, [user?.dark_mode])

  return null
}
