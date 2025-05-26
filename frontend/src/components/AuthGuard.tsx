'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMe } from '@/lib/api'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    getMe()
      .then(() => setLoading(false))
      .catch(() => router.push('/login'))
  }, [router])

  if (loading) return <div className="text-center mt-20">Загрузка...</div>
  return <>{children}</>
}
