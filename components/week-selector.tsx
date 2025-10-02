"use client"

import { useMemo } from "react"
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

export function WeekSelector({ value, onChange, count = 12 }: { value?: string; onChange: (v: string) => void; count?: number }) {
  const options = useMemo(() => {
    // Generate last `count` weeks, using Monday as week start
    const today = new Date()
    const startMonday = getMonday(today)
    const arr: { value: string; label: string }[] = []
    for (let i = 0; i < count; i++) {
      const start = addDays(startMonday, -7 * i)
      const end = addDays(start, 6)
      const startStr = formatDate(start)
      const endStr = formatDate(end)
      arr.push({ value: startStr, label: `${startStr} ~ ${endStr}` })
    }
    return arr
  }, [count])

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
