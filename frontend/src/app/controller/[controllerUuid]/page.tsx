'use client'

import { use } from 'react' // <-- импортируем use из react
import { useEffect, useState } from 'react'
import { getSensors, getMessages } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { DatePickerWithRange } from '@/components/date-range-picker'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

export default function ControllerChartsPage({ params }: { params: Promise<{ controllerUuid: string }> }) {
  const { controllerUuid } = use(params) // <-- здесь "распаковываем" промис

  const [sensors, setSensors] = useState<Sensor[]>([])
  const [messagesBySensor, setMessagesBySensor] = useState<Record<string, Message[]>>({})
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date()
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
    return { from: fiveMinAgo, to: now }
  })

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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Графики для контроллера {controllerUuid}</h1>
      <DatePickerWithRange date={dateRange} setDate={setDateRange} />

      {sensors.map((sensor) => (
        <Card key={sensor.uuid}>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">Датчик: {sensor.name} ({sensor.uuid})</h2>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={messagesBySensor[sensor.uuid] || []}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value) => [`${value}`, 'Значение']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
