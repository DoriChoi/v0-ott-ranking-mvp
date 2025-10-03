"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ViewMode } from "@/lib/types"

interface ViewTabsProps {
  value: ViewMode
  onChange: (value: ViewMode) => void
}

export function ViewTabs({ value, onChange }: ViewTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList>
        <TabsTrigger value="integrated">통합 Top100</TabsTrigger>
        <TabsTrigger value="category">카테고리별</TabsTrigger>
        <TabsTrigger value="country">국가별</TabsTrigger>
        <TabsTrigger value="popular">역대 인기</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
