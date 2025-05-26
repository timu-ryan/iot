'use client'

import { useEffect, useState } from 'react'
import {
  getControllers,
  getSensors,
  getRelays,
  getLatestMessage
} from '@/lib/api'
import AuthGuard from '@/components/AuthGuard'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { toggleRelay } from '@/lib/api'
import Link from 'next/link'

interface Controller {
  id: number
  uuid: string
  name: string
}

interface Sensor {
  id: number
  name: string
  uuid: string
  controller: string
}

interface Relay {
  id: number
  name: string
  uuid: string
  controller: number
  is_working: boolean
}

interface SensorWithValue extends Sensor {
  value?: number
}

export default function DashboardPage() {
  const [controllers, setControllers] = useState<Controller[]>([])
  const [sensors, setSensors] = useState<SensorWithValue[]>([])
  const [relays, setRelays] = useState<Relay[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const [ctrls, sens, rlys] = await Promise.all([
          getControllers(),
          getSensors(),
          getRelays()
        ])
        setControllers(ctrls)
        setSensors(sens)
        setRelays(rlys)
      } catch (e) {
        console.error('Ошибка загрузки данных', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Poll latest sensor values
  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedSensors = await Promise.all(
        sensors.map(async (s) => {
          try {
            const msg = await getLatestMessage(s.uuid)
            return msg
              ? { ...s, value: msg.value }
              : { ...s, value: undefined }  // или null, если предпочитаешь
          } catch (err) {
            console.warn(`Ошибка получения значения для ${s.uuid}`, err)
            return s
          }
        })
      )
      setSensors(updatedSensors)
    }, 5000)
  
    return () => clearInterval(interval)
  }, [sensors])

  const handleToggleRelay = async (relay: Relay) => {
    const confirmed = confirm(`Вы уверены, что хотите ${relay.is_working ? 'выключить' : 'включить'} реле "${relay.name}"?`)
    if (!confirmed) return

    try {
      await toggleRelay(
        controllers.find(c => c.id === relay.controller)!.uuid,
        relay.uuid,
        !relay.is_working
      )
      setRelays((prev) =>
        prev.map((r) =>
          r.id === relay.id ? { ...r, is_working: !relay.is_working } : r
        )
      )
    } catch (err) {
      alert('Ошибка при переключении реле')
      console.error(err)
    }
  }

  if (loading) return <div className="text-center mt-10">Загрузка...</div>

  return (
    <AuthGuard>
      <main className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {controllers.map((controller) => (
          <Card key={controller.id} className="p-4">
            <h2 className="text-xl font-bold mb-4">
              {controller.name || 'Без имени'}
            </h2>
            <Link href={`/controller/${controller.uuid}`}>Открыть графики</Link>
            <div className="mb-4">
              <h3 className="font-semibold mb-1">Датчики:</h3>
              <ul className="list-disc list-inside space-y-1">
                {sensors
                  .filter((s) => s.controller === controller.uuid)
                  .map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.name}</span>{' '}
                      <span className="text-sm text-gray-500">({s.uuid})</span>{' '}
                      — <span className="font-mono">{s.value ?? 'нет данных'}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Реле:</h3>
              <ul className="list-disc list-inside space-y-1">
                {relays
                  .filter((r) => r.controller === controller.id)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{r.name}</span>{' '}
                        <span className="text-sm text-gray-500">({r.uuid})</span>
                      </div>
                      <Switch
                        checked={r.is_working}
                        onCheckedChange={() => handleToggleRelay(r)}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </Card>
        ))}
      </main>
    </AuthGuard>
  )
}
