'use client'

import { Button } from '@/components/ui/button'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { useState } from 'react'
import { getMessages } from '@/lib/api' // путь подкорректируй под себя

type Props = {
  sensorId: string
  startDate: string
  endDate: string
}

export function ExportToExcelButton({ sensorId, startDate, endDate }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      // Получаем данные с API
      const data = await getMessages(sensorId, startDate, endDate)

      // Создаем Excel-файл
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Sensor Data')

      worksheet.columns = [
        { header: 'Дата и время', key: 'timestamp', width: 30 },
        { header: 'Значение', key: 'value', width: 15 },
      ]

      data.forEach((item: { timestamp: string; value: number }) => {
        worksheet.addRow({
          timestamp: new Date(item.timestamp).toLocaleString(),
          value: item.value,
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(blob, `sensor_${sensorId}_messages.xlsx`)
    } catch (error) {
      console.error('Ошибка экспорта в Excel:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? 'Экспорт...' : 'Экспорт в Excel'}
    </Button>
  )
}
