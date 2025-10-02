"use client"

import { useState } from "react"
import useSWR from "swr"
import type { ViewMode, WeeklyAPIResponse, CountryAPIResponse, MostPopularAPIResponse } from "@/lib/types"
import { ViewTabs } from "@/components/view-tabs"
import { RankCard } from "@/components/rank-card"
import { CountrySelector } from "@/components/country-selector"
import { WeekSelector } from "@/components/week-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorState } from "@/components/error-state"
import { convertToNetflixItems } from "@/lib/ranking"
import { RankGridSkeleton, CategoryGridSkeleton } from "@/components/skeletons"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("integrated")
  const [selectedCountry, setSelectedCountry] = useState("KR")
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined)

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

  const {
    data: countryData,
    error: countryError,
    mutate: mutateCountry,
  } = useSWR<CountryAPIResponse>(
    viewMode === "country" ? `/api/netflix/country/${selectedCountry}` : null,
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
  } = useSWR<MostPopularAPIResponse>(
    viewMode === "popular" ? "/api/netflix/most-popular" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )
 
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-balance">LiveRank Mini</h1>
              <p className="text-sm text-muted-foreground">Netflix 공식 Top10 랭킹 대시보드</p>
            </div>
            <Badge variant="outline" className="text-xs">
              <span className="w-2 h-2 rounded-full bg-[color:var(--color-netflix-red)] mr-2 animate-pulse" />
              Live Data
            </Badge>
          </div>
          <ViewTabs value={viewMode} onChange={setViewMode} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Integrated Top100 View */}
        {viewMode === "integrated" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">이번 주 통합 Top100</h2>
                <p className="text-sm text-muted-foreground">
                  {weeklyData?.weekStart && `${weeklyData.weekStart} ~ ${weeklyData.weekEnd}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
                {weeklyData && (
                  <Badge variant="secondary">{weeklyData.unifiedTop100.length}개 콘텐츠</Badge>
                )}
              </div>
            </div>

            {weeklyError && <ErrorState onRetry={() => mutateWeekly()} />}
            {!weeklyData && !weeklyError && <RankGridSkeleton count={12} />}
            {weeklyData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {weeklyData.unifiedTop100.map((item) => (
                  <RankCard key={(item as any).id ?? `${item.title}-${item.rank}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category View */}
        {viewMode === "category" && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">카테고리별 주간 Top10</h2>
              <p className="text-sm text-muted-foreground">
                영화/TV × 영어/비영어 4개 카테고리
                {weeklyData?.weekStart && ` • ${weeklyData.weekStart} ~ ${weeklyData.weekEnd}`}
              </p>
            </div>

            {weeklyError && <ErrorState onRetry={() => mutateWeekly()} />}
            {!weeklyData && !weeklyError && <CategoryGridSkeleton />}
            {weeklyData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { key: "tvEnglish", title: "TV (English)", data: weeklyData.globalByQuadrant.tvEnglish },
                  { key: "tvNonEnglish", title: "TV (Non-English)", data: weeklyData.globalByQuadrant.tvNonEnglish },
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
                    <CardContent className="space-y-2">
                      {(weeklyData.categoryItems
                        ? // server-enriched items
                          (
                            weeklyData.categoryItems[
                              category.key as keyof typeof weeklyData.categoryItems
                            ] || []
                          )
                        : // fallback to client conversion
                          convertToNetflixItems(category.data, 10)
                      ).map((item) => (
                        <RankCard
                          key={(item as any).id ?? `${item.title}-${item.rank}`}
                          item={item}
                          showChange={false}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Country View */}
        {viewMode === "country" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">국가별 주간 Top10</h2>
                <p className="text-sm text-muted-foreground">
                  {countryData?.weekStart && `${countryData.weekStart} ~ ${countryData.weekEnd}`}
                </p>
              </div>
              <CountrySelector value={selectedCountry} onChange={setSelectedCountry} />
            </div>

            {countryError && <ErrorState onRetry={() => mutateCountry()} />}
            {!countryData && !countryError && <RankGridSkeleton count={10} />}
            {countryData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {countryData.items.map((item) => (
                  <RankCard key={(item as any).id ?? `${item.title}-${item.rank}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Most Popular View */}
        {viewMode === "popular" && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">역대 Most Popular</h2>
              <p className="text-sm text-muted-foreground">91일 누적 Views 기준 Top10</p>
            </div>

            {popularError && <ErrorState onRetry={() => mutatePopular()} />}
            {!popularData && !popularError && <CategoryGridSkeleton />}
            {popularData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <CardContent className="space-y-2">
                      {category.data.slice(0, 10).map((row, index) => {
                        const displayTitle = (row as any).localizedTitle || row.title
                        const poster = (row as any).poster
                        const encodedTitle = encodeURIComponent(displayTitle.substring(0, 30))
                        const item = {
                          rank: index + 1,
                          title: displayTitle,
                          category: row.category,
                          language: row.languageType,
                          cumulativeViews: row.views91d,
                          cumulativeHours: row.hours91d,
                          poster: poster || `https://placehold.co/200x300/1a1a1a/white/png?text=${encodedTitle}`,
                        }
                        return (
                          <RankCard
                            key={(row as any).id ?? `${category.key}-${displayTitle}-${index}`}
                            item={item}
                            showChange={false}
                          />
                        )
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Data source: Netflix Official Top10 •{" "}
            <a
              href="https://www.netflix.com/tudum/top10"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              netflix.com/tudum/top10
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
