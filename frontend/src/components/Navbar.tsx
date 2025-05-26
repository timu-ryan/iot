'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { removeToken } from '@/lib/auth'

export default function Navbar() {
  const router = useRouter()

  function logout() {
    removeToken()
    router.push('/login')
  }

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between">
      <div className="space-x-4">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/sensors">Sensors</Link>
        <Link href="/controllers">Controllers</Link>
        <Link href="/messages">Messages</Link>
      </div>
      <button onClick={logout} className="text-red-400 hover:underline">Выйти</button>
    </nav>
  )
}
