"use client"

import { useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

function getMonday(d: Date) {
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = nd.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day // to Monday
  nd.setUTCDate(nd.getUTCDate() + diff)
  return nd
}

export function WeekSelector({ value, onChange, count = 4 }: { value?: string; onChange: (v: string) => void; count?: number }) {
  const options = useMemo(() => {
    // Generate last N Mondays up to today (UTC)
    const latestMonday = getMonday(new Date())
    const arr: { value: string; label: string }[] = []
    for (let i = 0; i < Math.max(1, count); i++) {
      const start = addDays(latestMonday, -7 * i)
      const end = addDays(start, 6)
      const startStr = formatDate(start)
      const endStr = formatDate(end)
      arr.push({ value: startStr, label: `${startStr} ~ ${endStr}` })
    }
    return arr
  }, [count])

  // Auto-select the latest week if no value is provided
  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[260px]">
        <SelectValue placeholder="주간 선택" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

