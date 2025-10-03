export interface NetflixItem {
  rank: number
  title: string
  category: "Films" | "TV"
  language: "English" | "Non-English"
  weeklyViews?: number
  weeklyHours?: number
  cumulativeViews?: number
  cumulativeHours?: number
  weeksInTop10?: number
  country?: string
  weekStart?: string
  weekEnd?: string
  changeFromLastWeek?: number
  poster?: string
}

export interface CategoryData {
  "Films (English)": NetflixItem[]
  "Films (Non-English)": NetflixItem[]
  "TV (English)": NetflixItem[]
  "TV (Non-English)": NetflixItem[]
}

export interface CountryData {
  country: string
  countryCode: string
  items: NetflixItem[]
}

export interface MostPopularData {
  category: string
  items: NetflixItem[]
}

export type ViewMode = "integrated" | "category" | "country" | "popular"
export type Category = "TV" | "Films"
export type LanguageType = "English" | "Non-English"

export interface WeeklyRowRaw {
  week?: string | number
  category?: string
  weekly_rank?: number
  show_title?: string
  season_title?: string
  weekly_hours_viewed?: number
  weekly_views?: number
  cumulative_weeks_in_top_10?: number
  [key: string]: any
}

export interface WeeklyRow {
  weekStart: string
  weekEnd: string
  title: string
  category: Category
  languageType: LanguageType
  hoursViewed: number
  views: number
  weeksInTop10: number
  countryCode?: string
  weeklyRank?: number
}

export interface PopularRowRaw {
  category?: string
  rank?: number
  show_title?: string
  season_title?: string
  hours_viewed_91d?: number
  views_91d?: number
  [key: string]: any
}

export interface PopularRow {
  title: string
  category: Category
  languageType: LanguageType
  views91d: number
  hours91d: number
  rank?: number
}

export interface WeeklyAPIResponse {
  globalByQuadrant: {
    tvEnglish: WeeklyRow[]
    tvNonEnglish: WeeklyRow[]
    filmsEnglish: WeeklyRow[]
    filmsNonEnglish: WeeklyRow[]
  }
  unifiedTop100: NetflixItem[]
  weekStart: string
  weekEnd: string
  categoryItems?: {
    tvEnglish: NetflixItem[]
    tvNonEnglish: NetflixItem[]
    filmsEnglish: NetflixItem[]
    filmsNonEnglish: NetflixItem[]
  }
}

export interface CountryAPIResponse {
  countryCode: string
  items: NetflixItem[]
  weekStart: string
  weekEnd: string
}

export interface MostPopularAPIResponse {
  tvEnglish: PopularRow[]
  tvNonEnglish: PopularRow[]
  filmsEnglish: PopularRow[]
  filmsNonEnglish: PopularRow[]
}

declare module "./types" {
  interface PopularRow {
    poster?: string
    localizedTitle?: string
  }
}
