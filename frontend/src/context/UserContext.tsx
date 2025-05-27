'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '@/lib/api'

type User = {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  company: number
} | null

const UserContext = createContext<{
  user: User
  setUser: (user: User) => void
}>({
  user: null,
  setUser: () => {}
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)

  useEffect(() => {
    // попытка загрузить пользователя, если токен есть
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
