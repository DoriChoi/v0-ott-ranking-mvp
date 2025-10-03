export type Platform = 'netflix' | 'disney' | 'wavve' | 'tving' | 'watcha' | 'coupang'

export interface OTTItem {
  platform: Platform
  title: string
  rank: number
  genre?: string | null
  week: string // YYYY-MM-DD (week-ending)
  weeklyViews?: number | null
}

export interface IntegratedItem {
  title: string
  score: number
  platforms: Platform[]
  mainPlatform: Platform
  totalViews: number
  platformCount: number
}

export function integrate(items: OTTItem[]): IntegratedItem[] {
  const map = new Map<string, {
    scores: number[]
    platforms: Platform[]
    totalViews: number
    bestRank: number
    bestPlatform: Platform
  }>()

  for (const it of items) {
    const score = Math.max(0, 11 - it.rank)
    if (!map.has(it.title)) {
      map.set(it.title, {
        scores: [],
        platforms: [],
        totalViews: 0,
        bestRank: it.rank,
        bestPlatform: it.platform,
      })
    }
    const v = map.get(it.title)!
    v.scores.push(score)
    v.platforms.push(it.platform)
    v.totalViews += it.weeklyViews ?? 0
    if (it.rank < v.bestRank) {
      v.bestRank = it.rank
      v.bestPlatform = it.platform
    }
  }

  const result: IntegratedItem[] = []
  for (const [title, v] of map) {
    result.push({
      title,
      score: v.scores.reduce((a, b) => a + b, 0),
      platforms: v.platforms,
      mainPlatform: v.bestPlatform,
      totalViews: v.totalViews,
      platformCount: v.platforms.length,
    })
  }

  return result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews
    return a.title.localeCompare(b.title, 'ko')
  })
}
