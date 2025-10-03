// Netflix data parsing and ranking constants

export const NETFLIX_URLS = {
  // Use same-origin public files
  WEEKLY_GLOBAL: "/netflix_global.xlsx",
  COUNTRY: "/netflix_country.xlsx",
  MOST_POPULAR: "/netflix_mostpopular.xlsx",
} as const

// Sheet name patterns for parsing
export const SHEET_PATTERNS = {
  TV_ENGLISH: /tv.*english/i,
  TV_NON_ENGLISH: /tv.*non.*english/i,
  FILMS_ENGLISH: /films.*english/i,
  FILMS_NON_ENGLISH: /films.*non.*english/i,
  COUNTRY_PREFIX: /^[A-Z]{2}$/i, // Country codes like KR, US
} as const

// Ranking weights for unified Top100
export const RANKING_WEIGHTS = {
  VIEWS_WEIGHT: 1.0,
  HOURS_WEIGHT: 0.8,
  RECENCY_BOOST: 0.1, // 10% boost for latest week
  WEEKS_IN_TOP10_PENALTY: 0.02, // Small penalty for older content
} as const

// Supported country codes
export const SUPPORTED_COUNTRIES = ["KR", "US", "GB", "JP", "FR", "DE"] as const

// Cache revalidation times (in seconds)
export const CACHE_TIMES = {
  WEEKLY: 86400, // 24 hours
  MOST_POPULAR: 604800, // 7 days
} as const

// Column name mappings for Excel parsing
export const COLUMN_MAPPINGS = {
  WEEK: ["week", "week_start", "weekstart"],
  TITLE: ["show_title", "title", "season_title"],
  SEASON_TITLE: ["season_title", "season title"],
  SHOW_TITLE: ["show_title", "show title", "title"],
  CATEGORY: ["category"],
  WEEKLY_HOURS: ["weekly_hours_viewed", "hours_viewed", "hours"],
  WEEKLY_VIEWS: ["weekly_views", "views"],
  CUMULATIVE_WEEKS: ["cumulative_weeks_in_top_10", "weeks_in_top_10", "weeks"],
  RANK: ["weekly_rank", "rank"],
  // Support multiple header variants seen across files
  HOURS_91D: [
    "hours_viewed_91d",
    "hours_91d",
    "hours_viewed_first_91_days",
    "hours_first_91_days",
    "hours_viewed_first_91_",
    "hours_first_91_",
  ],
  VIEWS_91D: [
    "views_91d",
    "views_first_91_days",
    "views_first_91_",
  ],
} as const
