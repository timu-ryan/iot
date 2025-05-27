'use client'

import { useEffect, useState } from 'react'
import {
  getControllers,
  getSensors,
  getRelays,
  getLatestMessage,
  toggleRelay,
  getMe
} from '@/lib/api'
import AuthGuard from '@/components/AuthGuard'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
  const [currentUser, setCurrentUser] = useState({})
  const [relays, setRelays] = useState<Relay[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRelay, setSelectedRelay] = useState<Relay | null>(null)
  const [pendingState, setPendingState] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [ctrls, sens, rlys, currUsr] = await Promise.all([
          getControllers(),
          getSensors(),
          getRelays(),
          getMe()
        ])
        setControllers(ctrls)
        setSensors(sens)
        setRelays(rlys)
        setCurrentUser(currUsr)
      } catch (e) {
        console.error('Ошибка загрузки данных', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedSensors = await Promise.all(
        sensors.map(async (s) => {
          try {
            const msg = await getLatestMessage(s.uuid)
            return msg
              ? { ...s, value: msg.value }
              : { ...s, value: undefined }
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

  const handleToggleDialog = (relay: Relay) => {
    setSelectedRelay(relay)
    setPendingState(!relay.is_working)
    setDialogOpen(true)
  }

  const confirmToggle = async () => {
    if (!selectedRelay) return
    try {
      await toggleRelay(
        controllers.find(c => c.id === selectedRelay.controller)!.uuid,
        selectedRelay.uuid,
        pendingState
      )
      setRelays((prev) =>
        prev.map((r) =>
          r.id === selectedRelay.id ? { ...r, is_working: pendingState } : r
        )
      )
    } catch (err) {
      alert('Ошибка при переключении реле')
      console.error(err)
    } finally {
      setDialogOpen(false)
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
            {currentUser.role === 'MANAGER' && <Link href={`/controller/${controller.uuid}`}>Открыть графики</Link>}
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
                        onCheckedChange={() => handleToggleDialog(r)}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </Card>
        ))}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердите действие</DialogTitle>
          </DialogHeader>
          <p>
            Вы уверены, что хотите {pendingState ? 'включить' : 'выключить'} реле{' '}
            <strong>{selectedRelay?.name}</strong>?
          </p>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={confirmToggle}>Подтвердить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthGuard>
  )
}
