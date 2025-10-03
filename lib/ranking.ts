import type { WeeklyRow, NetflixItem } from "./types"
import { RANKING_WEIGHTS } from "./constants"

function generatePosterUrl(title: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 30))
  return `https://placehold.co/200x300/1a1a1a/white/png?text=${encodedTitle}`
}

export function calculateUnifiedTop100(data: {
  tvEnglish: WeeklyRow[]
  tvNonEnglish: WeeklyRow[]
  filmsEnglish: WeeklyRow[]
  filmsNonEnglish: WeeklyRow[]
}): NetflixItem[] {
  const allData = [...data.tvEnglish, ...data.tvNonEnglish, ...data.filmsEnglish, ...data.filmsNonEnglish]
  if (allData.length === 0) {
    return []
  }

  const latestWeek = allData.reduce((latest, item) => {
    return item.weekStart > latest ? item.weekStart : latest
  }, allData[0].weekStart)

  const titleMap = new Map<string, WeeklyRow>()
  for (const item of allData) {
    const existing = titleMap.get(item.title)
    if (!existing || item.weekStart > existing.weekStart) {
      titleMap.set(item.title, item)
    }
  }

  const uniqueData = Array.from(titleMap.values())

  const scored = uniqueData.map((item) => {
    let score = item.views * RANKING_WEIGHTS.VIEWS_WEIGHT + item.hoursViewed * RANKING_WEIGHTS.HOURS_WEIGHT

    if (item.weekStart === latestWeek) {
      score *= 1 + RANKING_WEIGHTS.RECENCY_BOOST
    }

    const weeksPenalty = Math.min(item.weeksInTop10 * RANKING_WEIGHTS.WEEKS_IN_TOP10_PENALTY, 0.2)
    score *= 1 - weeksPenalty

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const top100 = scored.slice(0, 100).map((entry, index) => {
    const item = entry.item
    return {
      rank: index + 1,
      title: item.title,
      category: item.category,
      language: item.languageType,
      weeklyViews: item.views,
      weeklyHours: item.hoursViewed,
      weeksInTop10: item.weeksInTop10,
      weekStart: item.weekStart,
      weekEnd: item.weekEnd,
      poster: generatePosterUrl(item.title),
      changeFromLastWeek: 0,
    } as NetflixItem
  })

  return top100
}

export function convertToNetflixItems(rows: WeeklyRow[], limit = 10): NetflixItem[] {
  const sorted = [...rows].sort((a, b) => b.views - a.views)
  return sorted.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    title: row.title,
    category: row.category,
    language: row.languageType,
    weeklyViews: row.views,
    weeklyHours: row.hoursViewed,
    weeksInTop10: row.weeksInTop10,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    country: row.countryCode,
    poster: generatePosterUrl(row.title),
    changeFromLastWeek: 0,
  }))
}

export function convertToNetflixItemsFromCountry(rows: WeeklyRow[], limit = 10): NetflixItem[] {
  const hasWeeklyRank = rows.some((r) => typeof r.weeklyRank === "number" && !isNaN(r.weeklyRank as number))
  const sorted = hasWeeklyRank
    ? [...rows].sort((a, b) => (a.weeklyRank ?? 9999) - (b.weeklyRank ?? 9999))
    : [...rows].sort((a, b) => b.views - a.views)

  return sorted.slice(0, limit).map((row, index) => ({
    rank: row.weeklyRank ?? index + 1,
    title: row.title,
    category: row.category,
    language: row.languageType,
    weeklyViews: row.views,
    weeklyHours: row.hoursViewed,
    weeksInTop10: row.weeksInTop10,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    country: row.countryCode,
    poster: generatePosterUrl(row.title),
    changeFromLastWeek: 0,
  }))
}

export function getLatestWeek(rows: WeeklyRow[]): { weekStart: string; weekEnd: string } | null {
  if (rows.length === 0) return null
  const latest = rows.reduce((latest, item) => {
    return item.weekStart > latest.weekStart ? item : latest
  }, rows[0])
  return { weekStart: latest.weekStart, weekEnd: latest.weekEnd }
}
