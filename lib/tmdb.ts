export interface TMDBSearchResult {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  media_type?: 'movie' | 'tv'
}

export interface TMDBEnrichedMeta {
  tmdbId?: number
  poster?: string | null
  genres?: string[]
  year?: number | null
  overview?: string | null
  mediaType?: 'movie' | 'tv'
}

const TMDB_IMAGE_BASE = '/api/image?size=w500&path='

export async function searchTMDB(title: string): Promise<TMDBSearchResult | null> {
  const key = process.env.TMDB_KEY || process.env.NEXT_PUBLIC_TMDB_KEY
  if (!key) return null

  const url = new URL('https://api.themoviedb.org/3/search/multi')
  url.searchParams.set('api_key', key)
  url.searchParams.set('query', title)
  url.searchParams.set('language', 'ko-KR')

  const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } })
  if (!res.ok) return null
  const data = await res.json()
  const item = (data?.results?.[0] as TMDBSearchResult) || null
  return item
}

export async function enrichWithTMDB(title: string): Promise<TMDBEnrichedMeta | null> {
  try {
    const item = await searchTMDB(title)
    if (!item) return null

    const name = item.title || item.name || ''
    const date = item.release_date || item.first_air_date || ''
    const year = date ? Number(date.split('-')[0]) : null

    return {
      tmdbId: item.id,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}${encodeURIComponent(item.poster_path)}` : null,
      genres: [],
      year,
      overview: item.overview || null,
      mediaType: item.media_type || undefined,
    }
  } catch (e) {
    console.error('TMDB enrich error', e)
    return null
  }
}
