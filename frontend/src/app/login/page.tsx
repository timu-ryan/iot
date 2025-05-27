'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { login, getMe } from '@/lib/api'
import { saveToken } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUser } from '@/context/UserContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const { setUser } = useUser()
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = await login(email, password)
      saveToken(data.access)
      const user = await getMe() // проверить что токен валиден
      setUser(user)
      router.push('/dashboard')
    } catch (e) {
      setError('Неверный логин или пароль')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="text-red-500">{error}</div>}
      <Button className="w-full">Войти</Button>
    </form>
  )
}
