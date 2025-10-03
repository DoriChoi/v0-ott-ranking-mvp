import { NextRequest } from 'next/server'
import { cacheGet, cacheSet } from '@/lib/redis'
import { integrate, Platform, OTTItem } from '@/lib/integrate'

const TTL_SECONDS = 60 * 60 * 24 * 7

export const dynamic = 'force-dynamic'

const ALL_PLATFORMS: Platform[] = ['netflix', 'disney', 'wavve', 'tving', 'watcha', 'coupang']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const week = searchParams.get('week')
    const platformParam = (searchParams.get('platform') || 'all').toLowerCase()

    if (!week) {
      return json({ error: 'Missing week=YYYY-MM-DD' }, 400)
    }

    const key = `rankings:${week}:${platformParam}`
    const cached = await cacheGet<any>(key)
    if (cached) return json(cached)

    const platforms: Platform[] = platformParam === 'all'
      ? ALL_PLATFORMS
      : (platformParam.split(',').filter(Boolean) as Platform[])

    const all: OTTItem[] = []
    for (const p of platforms) {
      const raw = await cacheGet<OTTItem[]>(`raw:${week}:${p}`)
      if (Array.isArray(raw)) all.push(...raw)
    }

    const integrated = integrate(all)
    const payload = { week, platform: platformParam, items: integrated }
    await cacheSet(key, payload, TTL_SECONDS)
    return json(payload)
  } catch (e: any) {
    console.error('rankings error', e)
    return json({ error: 'internal_error', detail: e?.message }, 500)
  }
}

export async function OPTIONS() {
  return json({ ok: true })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
