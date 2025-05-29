'use client'

import { use } from 'react'
import { useEffect, useState } from 'react'
import { getSensors, getMessages } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  startOfHour,
  endOfHour,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subHours,
  subMinutes,
  isBefore,
  isAfter,
} from 'date-fns'

import { format } from 'date-fns'
import { ExportToExcelButton } from '@/components/ExportToExcelButton'

interface Sensor {
  id: number
  uuid: string
  name: string
  controller: string
  critical_min?: number
  critical_max?: number
}

interface Message {
  id: number
  value: number
  timestamp: string
  sensor_uuid: string
}

type PresetValue =
  | 'this_hour'
  | 'last_12_hours'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'custom'

const PRESETS = [
  { label: 'Этот час', value: 'this_hour' },
  // { label: 'Эти 12 часов', value: 'last_12_hours' },
  { label: 'Сегодня', value: 'today' },
  { label: 'Вчера', value: 'yesterday' },
  { label: 'Эта неделя', value: 'this_week' },
  { label: 'Этот месяц', value: 'this_month' },
  { label: 'Пользовательский', value: 'custom' },
]

export default function ControllerChartsPage({ params }: { params: Promise<{ controllerUuid: string }> }) {
  const { controllerUuid } = use(params)

  const [sensors, setSensors] = useState<Sensor[]>([])
  const [messagesBySensor, setMessagesBySensor] = useState<Record<string, Message[]>>({})

  const [preset, setPreset] = useState<PresetValue>('this_month')

  // Инициализация dateRange в зависимости от preset
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => getDateRangeByPreset('this_month'))

  useEffect(() => {
    setDateRange(getDateRangeByPreset(preset))
  }, [preset])

  useEffect(() => {
    async function fetchSensors() {
      const all = await getSensors()
      const filtered = all.filter((s: Sensor) => s.controller === controllerUuid)
      setSensors(filtered)
    }
    fetchSensors()
  }, [controllerUuid])

  useEffect(() => {
    async function fetchData() {
      const from = dateRange.from.toISOString()
      const to = dateRange.to.toISOString()

      const promises = sensors.map(async (sensor) => {
        try {
          const messages = await getMessages(sensor.uuid, from, to)
          return { uuid: sensor.uuid, messages }
        } catch (e) {
          console.warn('Ошибка получения сообщений для датчика', sensor.uuid, e)
          return { uuid: sensor.uuid, messages: [] }
        }
      })

      const results = await Promise.all(promises)
      const grouped: Record<string, Message[]> = {}
      results.forEach(({ uuid, messages }) => {
        grouped[uuid] = messages
      })
      setMessagesBySensor(grouped)
    }

    if (sensors.length > 0) {
      fetchData()
    }
  }, [sensors, dateRange])

  // Обновление dateRange при кастомном выборе
  function setFromDate(date: Date | undefined) {
    if (!date) return
    setPreset('custom')
    const newFrom = new Date(date)
    // Сохраняем часы/минуты
    newFrom.setHours(dateRange.from.getHours(), dateRange.from.getMinutes())
    if (isBefore(newFrom, dateRange.to) || newFrom.getTime() === dateRange.to.getTime()) {
      setDateRange({ from: newFrom, to: dateRange.to })
    }
  }

  function setToDate(date: Date | undefined) {
    if (!date) return
    setPreset('custom')
    const newTo = new Date(date)
    newTo.setHours(dateRange.to.getHours(), dateRange.to.getMinutes())
    if (isAfter(newTo, dateRange.from) || newTo.getTime() === dateRange.from.getTime()) {
      setDateRange({ from: dateRange.from, to: newTo })
    }
  }

  function setFromTime(time: string) {
    setPreset('custom')
    const [hours, minutes] = time.split(':').map(Number)
    const newFrom = new Date(dateRange.from)
    newFrom.setHours(hours, minutes)
    if (isBefore(newFrom, dateRange.to) || newFrom.getTime() === dateRange.to.getTime()) {
      setDateRange({ from: newFrom, to: dateRange.to })
    }
  }

  function setToTime(time: string) {
    setPreset('custom')
    const [hours, minutes] = time.split(':').map(Number)
    const newTo = new Date(dateRange.to)
    newTo.setHours(hours, minutes)
    if (isAfter(newTo, dateRange.from) || newTo.getTime() === dateRange.from.getTime()) {
      setDateRange({ from: dateRange.from, to: newTo })
    }
  }

  function formatDateTime(date: Date) {
    return format(date, 'yyyy-MM-dd HH:mm')
  }

  function calculateYDomain(sensor: Sensor, messages: Message[]): [number, number] {
    if (messages.length === 0) {
      // По умолчанию диапазон, например, 0-100, чтобы график рисовался
      return [0, 100]
    }
  
    const values = messages.map(m => m.value)
    let minValue = Math.min(...values)
    let maxValue = Math.max(...values)
  
    // Если есть критические значения, учитываем их тоже
    if (sensor.critical_min !== undefined) {
      minValue = Math.min(minValue, sensor.critical_min)
    }
    if (sensor.critical_max !== undefined) {
      maxValue = Math.max(maxValue, sensor.critical_max)
    }
  
    // Добавим запас 10% сверху и снизу
    const padding = (maxValue - minValue) * 0.1 || 1 // если диапазон 0, берем 1
    const domainMin = minValue - padding
    const domainMax = maxValue + padding
  
    return [domainMin, domainMax]
  }

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto ">
      <h1 className="text-2xl font-bold">Графики для контроллера {controllerUuid}</h1>

      {/* Выбор предустановок времени */}
      <div className="mb-4 w-64">
        <label htmlFor="preset-select" className="block mb-1 font-semibold">
          Выберите интервал
        </label>
        <Select value={preset} onValueChange={setPreset} id="preset-select">
          <SelectTrigger>
            <SelectValue placeholder="Выберите интервал" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {preset === 'custom' && (
        <div className="flex gap-6 mb-6">
          <div className="flex flex-col">
            <span className="mb-1 font-semibold">Начало интервала</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 justify-between">
                  {formatDateTime(dateRange.from)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.from} onSelect={setFromDate} initialFocus />
                <div className="p-2 border-t flex justify-center gap-2">
                  <Input
                    type="time"
                    value={format(dateRange.from, 'HH:mm')}
                    onChange={(e) => setFromTime(e.target.value)}
                    className="w-28"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col">
            <span className="mb-1 font-semibold">Конец интервала</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 justify-between">
                  {formatDateTime(dateRange.to)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.to} onSelect={setToDate} initialFocus />
                <div className="p-2 border-t flex justify-center gap-2">
                  <Input
                    type="time"
                    value={format(dateRange.to, 'HH:mm')}
                    onChange={(e) => setToTime(e.target.value)}
                    className="w-28"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {sensors.map((sensor) => (
        <Card key={sensor.uuid}>
          <CardContent className="pb-4">
            <div className='flex justify-between items-center mb-4'>
              <h2 className="font-semibold">
                Датчик: {sensor.name} ({sensor.uuid})
              </h2>
              <ExportToExcelButton
                sensorId={sensor.uuid}
                startDate={dateRange.from.toISOString()}
                endDate={dateRange.to.toISOString()}
              />
            </div>
            <div className="w-full h-64">
            {messagesBySensor[sensor.uuid]?.length === 0 ? (
              <div className="text-center text-muted-foreground mt-8">Нет данных за выбранный период</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(messagesBySensor[sensor.uuid] || []).map((msg) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp).getTime(),
                }))}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="timestamp"
                  domain={[dateRange.from.getTime(), dateRange.to.getTime()]}
                  ticks={createTicks(dateRange.from, dateRange.to, 5)}
                  tickFormatter={(unixTime) =>
                    new Date(unixTime).toLocaleString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'numeric',
                    })
                  }
                />
                <YAxis domain={calculateYDomain(sensor, messagesBySensor[sensor.uuid] || [])} />

                {/* Линия минимального критического значения */}
                {sensor.critical_min !== undefined && (
                  <ReferenceLine
                    y={sensor.critical_min}
                    label={{
                      value: `мин. критическое (${sensor.critical_min})`,
                      position: 'top',
                      fill: 'red',
                      fontSize: 12,
                    }}
                    stroke="red"
                    strokeDasharray="3 3"
                    ifOverflow="visible"
                  />
                )}

                {/* Линия максимального критического значения */}
                {sensor.critical_max !== undefined && (
                  <ReferenceLine
                    y={sensor.critical_max}
                    label={{
                      value: `макс. критическое (${sensor.critical_max})`,
                      position: 'bottom',
                      fill: 'red',
                      fontSize: 12,
                    }}
                    stroke="red"
                    strokeDasharray="3 3"
                    ifOverflow="visible"
                  />
                )}

                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value).toLocaleString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'numeric',
                    })
                  }
                  formatter={(value) => [`${value}`, 'Значение']}
                />
                <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} />
              </LineChart>

              </ResponsiveContainer>
            )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function createTicks(start: Date, end: Date, count: number) {
  const startTime = start.getTime()
  const endTime = end.getTime()
  const interval = (endTime - startTime) / (count - 1)
  const ticks: number[] = []
  for (let i = 0; i < count; i++) {
    ticks.push(startTime + i * interval)
  }
  return ticks
}

// Рассчитываем даты по выбранному пресету
function getDateRangeByPreset(preset: PresetValue): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case 'this_hour':
      return { from: startOfHour(now), to: endOfHour(now) }
    case 'last_12_hours':
      return { from: subHours(now, 12), to: now }
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const yesterday = subDays(now, 1)
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) }
    }
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) } // неделя с понедельника
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'custom':
    default:
      // В custom лучше вернуть последние 5 минут по умолчанию, но сюда обычно не заходит
      return { from: subMinutes(now, 5), to: now }
  }
}
