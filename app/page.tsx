"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import type { ViewMode, WeeklyAPIResponse, CountryAPIResponse, MostPopularAPIResponse } from "@/lib/types"
import { ViewTabs } from "@/components/view-tabs"
import { RankCard } from "@/components/rank-card"
import { CountrySelector } from "@/components/country-selector"
import { WeekSelector } from "@/components/week-selector"
import { DaySelector } from "@/components/day-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "@/components/error-state"
import { convertToNetflixItems } from "@/lib/ranking"
import { RankGridSkeleton, CategoryGridSkeleton } from "@/components/skeletons"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || `Request failed: ${res.status}`)
    ;(err as any).status = res.status
    throw err
  }
  return data
}

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("integrated")
  const [selectedCountry, setSelectedCountry] = useState("KR")
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined)
  const [selectedCountryDay, setSelectedCountryDay] = useState<string>("2025-09-28")

  const {
    data: weeklyData,
    error: weeklyError,
    mutate: mutateWeekly,
  } = useSWR<WeeklyAPIResponse>(
    selectedWeek ? `/api/netflix/weekly?week=${encodeURIComponent(selectedWeek)}` : "/api/netflix/weekly",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  useEffect(() => {
    if (weeklyData?.weekStart) {
      if (!selectedWeek || selectedWeek !== weeklyData.weekStart) {
        setSelectedWeek(weeklyData.weekStart)
      }
    }
  }, [weeklyData?.weekStart])

  const {
    data: countryData,
    error: countryError,
    mutate: mutateCountry,
  } = useSWR<CountryAPIResponse>(
    viewMode === "country"
      ? `/api/netflix/country/${selectedCountry}${selectedCountryDay ? `?week=${encodeURIComponent(selectedCountryDay)}` : ""}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  const {
    data: popularData,
    error: popularError,
    mutate: mutatePopular,
  } = useSWR<MostPopularAPIResponse>(viewMode === "popular" ? "/api/netflix/most-popular" : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">LiveRank Mini</h1>
              <p className="text-sm text-muted-foreground">Netflix 공식 Top10 랭킹 대시보드</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                Live Data
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Integrated Top100 View */}
        {viewMode === "integrated" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>이번 주 통합 Top100</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {weeklyData?.weekStart && `${weeklyData.weekStart} ~ ${weeklyData.weekEnd}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
                    {weeklyData?.unifiedTop100 && Array.isArray(weeklyData.unifiedTop100) && (
                      <Badge variant="secondary">{weeklyData.unifiedTop100.length}개 콘텐츠</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {weeklyError && <ErrorState onRetry={() => mutateWeekly()} />}
                {!weeklyData && !weeklyError && <RankGridSkeleton />}
                {weeklyData?.unifiedTop100 && weeklyData.unifiedTop100.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {weeklyData.unifiedTop100.map((item) => (
                      <RankCard key={`${item.rank}-${item.title}`} item={item} />
                    ))}
                  </div>
                )}
                {weeklyData && (!weeklyData.unifiedTop100 || weeklyData.unifiedTop100.length === 0) && (
                  <p className="text-center text-muted-foreground">해당 주간에 표시할 통합 Top100 데이터가 없습니다.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category View */}
        {viewMode === "category" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>카테고리별 주간 Top10</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      영화/TV × 영어/비영어 4개 카테고리
                      {weeklyData?.weekStart && ` • ${weeklyData.weekStart} ~ ${weeklyData.weekEnd}`}
                    </p>
                  </div>
                  <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
                </div>
              </CardHeader>
              <CardContent>
                {weeklyError && <ErrorState onRetry={() => mutateWeekly()} />}
                {!weeklyData && !weeklyError && <CategoryGridSkeleton />}
                {weeklyData && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {[
                      { key: "tvEnglish", title: "TV (English)", data: weeklyData.globalByQuadrant.tvEnglish },
                      {
                        key: "tvNonEnglish",
                        title: "TV (Non-English)",
                        data: weeklyData.globalByQuadrant.tvNonEnglish,
                      },
                      { key: "filmsEnglish", title: "Films (English)", data: weeklyData.globalByQuadrant.filmsEnglish },
                      {
                        key: "filmsNonEnglish",
                        title: "Films (Non-English)",
                        data: weeklyData.globalByQuadrant.filmsNonEnglish,
                      },
                    ].map((category) => (
                      <Card key={category.key}>
                        <CardHeader>
                          <CardTitle className="text-lg">{category.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(weeklyData.categoryItems
                            ? weeklyData.categoryItems[category.key as keyof typeof weeklyData.categoryItems] || []
                            : convertToNetflixItems(category.data, 10)
                          ).map((item) => (
                            <RankCard key={`${item.rank}-${item.title}`} item={item} showChange={false} />
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Country View */}
        {viewMode === "country" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>국가별 주간 Top10</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {countryData?.weekStart && `${countryData.weekStart}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CountrySelector value={selectedCountry} onChange={setSelectedCountry} />
                    <DaySelector value={selectedCountryDay} onChange={setSelectedCountryDay} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {countryError && <ErrorState onRetry={() => mutateCountry()} />}
                {!countryData && !countryError && <RankGridSkeleton />}
                {countryData?.items && countryData.items.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {countryData.items.map((item) => (
                      <RankCard key={`${item.rank}-${item.title}`} item={item} showChange={false} />
                    ))}
                  </div>
                )}
                {countryData && (!countryData.items || countryData.items.length === 0) && (
                  <p className="text-center text-muted-foreground">해당 주간에 표시할 국가별 데이터가 없습니다.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Most Popular View */}
        {viewMode === "popular" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>역대 Most Popular</CardTitle>
                <p className="text-sm text-muted-foreground">파일 제공 값 기준 Top10</p>
              </CardHeader>
              <CardContent>
                {popularError && <ErrorState onRetry={() => mutatePopular()} />}
                {!popularData && !popularError && <CategoryGridSkeleton />}
                {popularData && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {[
                      { key: "tvEnglish", title: "TV (English)", data: popularData.tvEnglish },
                      { key: "tvNonEnglish", title: "TV (Non-English)", data: popularData.tvNonEnglish },
                      { key: "filmsEnglish", title: "Films (English)", data: popularData.filmsEnglish },
                      { key: "filmsNonEnglish", title: "Films (Non-English)", data: popularData.filmsNonEnglish },
                    ].map((category) => (
                      <Card key={category.key}>
                        <CardHeader>
                          <CardTitle className="text-lg">{category.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {category.data.slice(0, 10).map((row, idx) => {
                            const item = {
                              rank: row.rank || idx + 1,
                              title: row.title,
                              category: row.category,
                              language: row.languageType,
                              weeklyViews: row.views91d,
                              weeklyHours: row.hours91d,
                              poster: `https://placehold.co/200x300/1a1a1a/white/png?text=${encodeURIComponent(row.title.substring(0, 30))}`,
                            }
                            return <RankCard key={`${item.rank}-${item.title}`} item={item} showChange={false} />
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* View Mode Tabs - Fixed at bottom */}
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-lg border bg-card p-2 shadow-lg">
            <ViewTabs value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </main>
    </div>
  )
}
