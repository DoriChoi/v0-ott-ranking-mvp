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
  days?: string[] // in descending order preferred
}) {
  const options = useMemo(() => {
    // Ensure unique and keep order
    const uniq: string[] = []
    for (const d of days) if (!uniq.includes(d)) uniq.push(d)
    return uniq.map((d) => ({ value: d, label: d }))
  }, [days])

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="날짜 선택" />
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
