'use client'

import { useEffect, useState } from 'react'
import {
  getControllers,
  getSensors,
  getRelays,
  getLatestMessage,
  toggleRelay,
  getMe,
  updateControllerMode
} from '@/lib/api'
import AuthGuard from '@/components/AuthGuard'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'

interface Controller {
  id: number
  uuid: string
  name: string
  control_mode: string
}

interface Sensor {
  id: number
  name: string
  uuid: string
  controller: string
  critical_min?: number
  critical_max?: number
  unit_of_measurements?: string
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

  const { user } = useUser()

  const [controllers, setControllers] = useState<Controller[]>([])
  const [sensors, setSensors] = useState<SensorWithValue[]>([])
  const [relays, setRelays] = useState<Relay[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRelay, setSelectedRelay] = useState<Relay | null>(null)
  const [pendingState, setPendingState] = useState(false)

  const [selectedController, setSelectedController] = useState<Controller | null>(null)
  const [isModeChange, setIsModeChange] = useState(false)
  const [newMode, setNewMode] = useState<'manual' | 'auto'>('manual')

  useEffect(() => {
    async function fetchData() {
      try {
        const [ctrls, sens, rlys] = await Promise.all([
          getControllers(),
          getSensors(),
          getRelays()
        ])
        setControllers(ctrls)
        setRelays(rlys)

        const updatedSensors = await Promise.all(
          sens.map(async (s) => {
            try {
              const msg = await getLatestMessage(s.uuid);
              return msg ? { ...s, value: msg.value } : s;
            } catch (err) {
              console.warn(`Ошибка получения значения для ${s.uuid}`, err);
              return s;
            }
          })
        );

        setSensors(updatedSensors)
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
    try {
      if (isModeChange && selectedController) {
        const updated = await updateControllerMode(selectedController.id, newMode)
        setControllers(prev =>
          prev.map(c =>
            c.id === selectedController.id ? { ...c, control_mode: updated.control_mode } : c
          )
        )
      } else if (selectedRelay) {
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
      }
    } catch (err) {
      alert('Ошибка при выполнении действия')
      console.error(err)
    } finally {
      setDialogOpen(false)
      setSelectedRelay(null)
      setSelectedController(null)
      setIsModeChange(false)
    }
  }

  if (loading) return <div className="text-center mt-10">Загрузка...</div>

  return (
    <AuthGuard>
      <main className="p-6 max-w-[1440px] mx-auto grid max-lg:grid-cols-1 max-[1400px]:grid-cols-2 grid-cols-3 gap-6">
        {controllers.map((controller) => (
          <Card key={controller.id} className="p-4">
            <h2 className="text-xl font-bold mb-4">
              {controller.name || 'Без имени'} <span className="text-[12px] text-gray-500">({controller.uuid})</span>{' '}
            </h2>
            {user?.role === 'MANAGER' && <Link href={`/controller/${controller.uuid}`} className='underline'>Открыть графики</Link>}
            <div className="mb-4">
              <h3 className="font-semibold mb-1">Датчики:</h3>
              <ul className="list-disc list-inside space-y-1">
                {sensors
                  .filter((s) => controller.uuid === s.controller)
                  .map((s) => (
                    <li key={s.id} className="border-grey border-b-[1px] py-4 px-2 list-none">
                      <div className="mb-1">
                        <div className="text-base font-medium text-gray-800">{s.name}</div>
                        <div className="text-xs text-gray-500 font-mono break-all">{s.uuid}</div>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        Значение: <span className="font-mono">{s.value ?? 'нет данных'} {s.unit_of_measurements}</span>
                      </div>
                      <div className="mt-2 w-[90%] mx-auto">
                        <SensorScale 
                          value={s.value} 
                          critical_min={s.critical_min} 
                          critical_max={s.critical_max} 
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span>Режим управления:</span>
                <Switch
                  checked={controller.control_mode === 'manual'}
                  onCheckedChange={async () => {
                    const mode = controller.control_mode === 'manual' ? 'auto' : 'manual'
                    setSelectedController(controller)
                    setNewMode(mode)
                    setIsModeChange(true)
                    setDialogOpen(true)
                  }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Сейчас: <strong>{controller.control_mode === 'manual' ? 'Ручной' : 'Автоматический'}</strong>
              </p>
            </div>
            {controller?.control_mode.toLowerCase() === 'manual' 
              ? <div>
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
              : 
                <>
                  <div className='opacity-40'>
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
                            />
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
            
            }
          </Card>
        ))}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтвердите действие</DialogTitle>
          </DialogHeader>
          {isModeChange && selectedController ? (
            <p>
              Вы уверены, что хотите переключить режим управления контроллера{' '}
              <strong>{selectedController.name}</strong> на{' '}
              <strong>{newMode === 'manual' ? 'ручной' : 'автоматический'}</strong>?
            </p>
          ) : (
            <p>
              Вы уверены, что хотите {pendingState ? 'включить' : 'выключить'} реле{' '}
              <strong>{selectedRelay?.name}</strong>?
            </p>
          )}
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


function SensorScale({
  value,
  critical_min,
  critical_max
}: {
  value?: number;
  critical_min?: number;
  critical_max?: number;
}) {
  if (
    value === undefined ||
    critical_min === undefined ||
    critical_max === undefined
  )
    return null;

  const scaleWidth = Math.max(
    0,
    Math.min(100, ((value - critical_min) / (critical_max - critical_min)) * 100)
  );
  const isInCriticalRange = value < critical_min || value > critical_max;
  const isInWarningRange =
    (value - critical_min) / (critical_max - critical_min) < 0.2 ||
    (critical_max - value) / (critical_max - critical_min) < 0.2;

  let scaleColor = 'bg-green-500';
  let borderColor = 'border-green-500'
  if (isInCriticalRange) {
    scaleColor = 'bg-red-500';
    borderColor = 'border-red-500'
  } else if (isInWarningRange) {
    scaleColor = 'bg-yellow-500';
    borderColor = 'border-yellow-500'
  }

  return (
    <div>
      <div className={`w-full h-3 bg-gray-200 rounded-full overflow-hidden border-[1px] ${borderColor}`}>
        <div
          className={`h-full ${scaleColor}`}
          style={{ width: `${scaleWidth}%` }}
        />
      </div>
      <div className="flex justify-between text-[12px] text-gray-500 mt-1">
        <span>{critical_min}</span>
        <span>{critical_max}</span>
      </div>
    </div>
  );
}
