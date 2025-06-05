'use client'

import { useEffect, useState } from 'react'
import {
  getLatestMessage,
} from '@/lib/api'
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'


interface Sensor {
  id: number
  name: string
  uuid: string
  controller: string
  critical_min?: number
  critical_max?: number
  unit_of_measurements?: string
}

interface SensorWithValue extends Sensor {
  value?: number
}

export default function AlertsPanel({ sensors }: { sensors: SensorWithValue[] }) {
  const [criticalSensors, setCriticalSensors] = useState<SensorWithValue[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const interval = setInterval(async () => {
      const updatedSensors = await Promise.all(
        sensors.map(async (s) => {
          try {
            const msg = await getLatestMessage(s.uuid)
            const value = msg?.value
            return msg ? { ...s, value } : { ...s, value: undefined }
          } catch {
            return s
          }
        })
      )

      const critical = updatedSensors.filter((s) =>
        s.value !== undefined &&
        (
          (s.critical_min !== undefined && s.value < s.critical_min) ||
          (s.critical_max !== undefined && s.value > s.critical_max)
        )
      )

      setCriticalSensors(critical)
    }, 5000)

    return () => clearInterval(interval)
  }, [sensors])

  return (
    <div className="sticky z-50 right-4 top-6 hidden lg:block">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="relative rounded-full p-3 shadow-md hover:shadow-lg cursor-pointer">
            <span>Уведомления</span>
            <Bell className="w-5 h-5" />
            {criticalSensors.length > 0 && (
              <Badge
                className="absolute -top-1 -right-1 rounded-full px-2 py-0.5 text-xs"
                variant="destructive"
              >
                {criticalSensors.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[320px] h-[97vh] mt-[1.5vh] mr-[1.5vh] sm:w-[360px] overflow-y-auto rounded-md">
          <h2 className="text-lg font-semibold mb-4 text-center mt-4">⚠️ Критичные значения</h2>
          {criticalSensors.length === 0 ? (
            <p className="text-sm text-muted-foreground mx-3">Нет ошибок</p>
          ) : (
            <ul className="space-y-3">
              {criticalSensors.map((s) => (
                <li key={s.id} className="border border-red-300 bg-red-50 p-3 mx-3 rounded">
                  <div className="font-semibold text-red-800">{s.name}</div>
                  <div className="text-sm text-gray-700 break-words">UUID: {s.uuid}</div>
                  <div className="text-sm">
                    Значение: <span className="font-mono">{s.value}</span> {s.unit_of_measurements}
                  </div>
                  <div className="text-xs text-gray-500">
                    Диапазон: от {s.critical_min} до {s.critical_max}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
