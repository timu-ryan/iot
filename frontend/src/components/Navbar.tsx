'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { removeToken } from '@/lib/auth'
import { useUser } from '@/context/UserContext'

export default function Navbar() {
  const router = useRouter()

  const { user, setUser } = useUser()

  function logout() {
    removeToken()
    setUser(null)
    router.push('/login')
  }

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className='flex justify-between max-w-[1440px] mx-auto px-[20px]'>
        <div className="space-x-4">
          <Link href="/dashboard" className='hover:underline'>Dashboard</Link>
          {/* <Link href="/sensors">Sensors</Link>
          <Link href="/controllers">Controllers</Link>
          <Link href="/messages">Messages</Link> */}
        </div>
        <div>
        <span className='mr-[20px]'>{user?.last_name} {user?.first_name}</span>
          {user && <span className='mr-[30px]'>{user?.role === 'MANAGER' ? 'Инженер' : 'Оператор'}</span>}
          <button onClick={logout} className="text-red-400 hover:underline cursor-pointer">Выйти</button>
        </div>
      </div>
    </nav>
  )
}
