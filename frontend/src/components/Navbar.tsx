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
      {!user && <div className='text-center text-xl'>Вход в систему</div>}
      {user && <div className='flex justify-between max-w-[1440px] mx-auto px-[20px]'>
        <div className="space-x-4">
          {user && <Link href="/dashboard" className='hover:underline'>Панель управления</Link>}
        </div>
        <div>
        <span className='mr-[20px]'>{user?.last_name} {user?.first_name}</span>
          {user && <span className='mr-[30px]'>{user?.role === 'MANAGER' ? 'Инженер' : 'Оператор'}</span>}
          {user && <button onClick={logout} className="text-red-400 hover:underline cursor-pointer">Выйти</button>}
        </div>
      </div>}
    </nav>
  )
}
