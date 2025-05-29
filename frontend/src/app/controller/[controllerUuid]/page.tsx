'use client'

import { use } from 'react'
import { useEffect, useState } from 'react'
import { getSensors, getMessages } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { format } from 'date-fns'

interface Sensor {
  id: number
  uuid: string
  name: string
  controller: string
}

interface Message {
  id: number
  value: number
  timestamp: string
  sensor_uuid: string
}

const PRESETS = [
  { label: 'Последний час', value: 'last_1h', durationMs: 1 * 60 * 60 * 1000 },
  { label: 'Последние 12 часов', value: 'last_12h', durationMs: 12 * 60 * 60 * 1000 },
  { label: 'Последний день', value: 'last_1d', durationMs: 24 * 60 * 60 * 1000 },
  { label: 'Последние 7 дней', value: 'last_7d', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Пользовательский', value: 'custom', durationMs: 0 },
]

export default function ControllerChartsPage({ params }: { params: Promise<{ controllerUuid: string }> }) {
  const { controllerUuid } = use(params)

  const [sensors, setSensors] = useState<Sensor[]>([])
  const [messagesBySensor, setMessagesBySensor] = useState<Record<string, Message[]>>({})

  const [preset, setPreset] = useState<string>('last_1d')

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date()
    return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now }
  })

  const [ticks, setTicks] = useState<number[]>([])

  useEffect(() => {
    setTicks(createTicks(dateRange.from, dateRange.to, 5))
  }, [dateRange])

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

  useEffect(() => {
    if (preset === 'custom') return

    const now = new Date()
    const presetObj = PRESETS.find((p) => p.value === preset)
    if (!presetObj) return

    setDateRange({ from: new Date(now.getTime() - presetObj.durationMs), to: now })
  }, [preset])

  function formatDateTime(date: Date) {
    return format(date, 'yyyy-MM-dd HH:mm')
  }

  function setFromDate(date: Date | undefined) {
    if (!date) return
    setPreset('custom')
    const newFrom = new Date(date)
    newFrom.setHours(dateRange.from.getHours(), dateRange.from.getMinutes())
    if (newFrom <= dateRange.to) {
      setDateRange({ from: newFrom, to: dateRange.to })
    }
  }

  function setToDate(date: Date | undefined) {
    if (!date) return
    setPreset('custom')
    const newTo = new Date(date)
    newTo.setHours(dateRange.to.getHours(), dateRange.to.getMinutes())
    if (newTo >= dateRange.from) {
      setDateRange({ from: dateRange.from, to: newTo })
    }
  }

  function setFromTime(time: string) {
    setPreset('custom')
    const [hours, minutes] = time.split(':').map(Number)
    const newFrom = new Date(dateRange.from)
    newFrom.setHours(hours, minutes)
    if (newFrom <= dateRange.to) {
      setDateRange({ from: newFrom, to: dateRange.to })
    }
  }

  function setToTime(time: string) {
    setPreset('custom')
    const [hours, minutes] = time.split(':').map(Number)
    const newTo = new Date(dateRange.to)
    newTo.setHours(hours, minutes)
    if (newTo >= dateRange.from) {
      setDateRange({ from: dateRange.from, to: newTo })
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <h1 className="text-2xl font-bold">Графики для контроллера {controllerUuid}</h1>

      {/* shadcn Select */}
      <div className="mb-4 w-64">
        <label htmlFor="preset-select" className="block mb-1 font-semibold">
          Интервал времени
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
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">
              Датчик: {sensor.name} ({sensor.uuid})
            </h2>
            <div className="w-full h-64">
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
                    ticks={ticks}
                    tickFormatter={(unixTime) =>
                      new Date(unixTime).toLocaleString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'numeric',
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(value).toLocaleString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'numeric',
                      })
                    }
                  />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" dot={true} />
                </LineChart>
              </ResponsiveContainer>
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
