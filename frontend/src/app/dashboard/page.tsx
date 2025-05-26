'use client'

import { useEffect, useState } from 'react'
import { getControllers, getSensors } from '@/lib/api'
import AuthGuard from '@/components/AuthGuard'
import { Card } from '@/components/ui/card'

export default function DashboardPage() {
  const [controllers, setControllers] = useState<any[]>([])
  const [sensors, setSensors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [ctrls, sens] = await Promise.all([
          getControllers(),
          getSensors()
        ])
        setControllers(ctrls)
        setSensors(sens)
      } catch (e) {
        console.error('Ошибка загрузки данных', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div className="text-center mt-10">Загрузка...</div>

  return (
    <AuthGuard>
      <main className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="text-xl font-bold mb-2">Контроллеры</h2>
          <ul className="list-disc list-inside space-y-1">
            {controllers.map(c => (
              <li key={c.id || c.uuid}>{c.name || 'Без имени'}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-bold mb-2">Датчики</h2>
          <ul className="list-disc list-inside space-y-1">
            {sensors.map(s => (
              <li key={s.id || s.uuid}>{s.name || 'Без имени'}</li>
            ))}
          </ul>
        </Card>
      </main>
    </AuthGuard>
  )
}
