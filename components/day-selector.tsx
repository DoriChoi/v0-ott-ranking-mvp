"use client"

import { useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DaySelector({
  value,
  onChange,
  days = ["2025-09-28", "2025-09-21", "2025-09-14", "2025-09-07"],
}: {
  value?: string
  onChange: (v: string) => void
  days?: string[]
}) {
  const options = useMemo(() => {
    const uniq: string[] = []
    for (const d of days) if (!uniq.includes(d)) uniq.push(d)
    return uniq.map((d) => ({ value: d, label: d }))
  }, [days])

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value)
    }
  }, [options])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
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
