import type { WeeklyRow, NetflixItem } from "./types"
import { RANKING_WEIGHTS } from "./constants"

function generatePosterUrl(title: string): string {
  const encodedTitle = encodeURIComponent(title.substring(0, 30))
  return `https://placehold.co/200x300/1a1a1a/white/png?text=${encodedTitle}`
}

/**
 * Calculate unified Top100 from weekly data
 * Sorting by: views (primary), hours (secondary), recency boost
 */
export function calculateUnifiedTop100(data: {
  tvEnglish: WeeklyRow[]
  tvNonEnglish: WeeklyRow[]
  filmsEnglish: WeeklyRow[]
  filmsNonEnglish: WeeklyRow[]
}): NetflixItem[] {
  // Combine all data
  const allData = [...data.tvEnglish, ...data.tvNonEnglish, ...data.filmsEnglish, ...data.filmsNonEnglish]

  if (allData.length === 0) {
    return []
  }

  // Find latest week
  const latestWeek = allData.reduce((latest, item) => {
    return item.weekStart > latest ? item.weekStart : latest
  }, allData[0].weekStart)

  // Deduplicate by title (keep most recent)
  const titleMap = new Map<string, WeeklyRow>()
  for (const item of allData) {
    const existing = titleMap.get(item.title)
    if (!existing || item.weekStart > existing.weekStart) {
      titleMap.set(item.title, item)
    }
  }

  const uniqueData = Array.from(titleMap.values())

  // Calculate score for each item
  const scored = uniqueData.map((item) => {
    let score = item.views * RANKING_WEIGHTS.VIEWS_WEIGHT + item.hoursViewed * RANKING_WEIGHTS.HOURS_WEIGHT

    // Apply recency boost for latest week
    if (item.weekStart === latestWeek) {
      score *= 1 + RANKING_WEIGHTS.RECENCY_BOOST
    }

    // Small penalty for content that's been in top 10 for many weeks (to favor fresh content)
    const weeksPenalty = Math.min(item.weeksInTop10 * RANKING_WEIGHTS.WEEKS_IN_TOP10_PENALTY, 0.2)
    score *= 1 - weeksPenalty

    return { item, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Take top 100 and convert to NetflixItem
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
      // Change from last week would require historical data
      changeFromLastWeek: 0,
    } as NetflixItem
  })

  return top100
}

/**
 * Convert WeeklyRow array to NetflixItem array (for category/country views)
 */
export function convertToNetflixItems(rows: WeeklyRow[], limit = 10): NetflixItem[] {
  // Sort by views descending
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

/**
 * Convert WeeklyRow array (country view) using source weeklyRank when available.
 */
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

/**
 * Get latest week from data
 */
export function getLatestWeek(rows: WeeklyRow[]): { weekStart: string; weekEnd: string } | null {
  if (rows.length === 0) return null

  const latest = rows.reduce((latest, item) => {
    return item.weekStart > latest.weekStart ? item : latest
  }, rows[0])

  return { weekStart: latest.weekStart, weekEnd: latest.weekEnd }
}
