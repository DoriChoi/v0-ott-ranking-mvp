import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const platform = (searchParams.get('platform') || '').toLowerCase()

  if (!platform) {
    return json({ error: 'Missing platform param' }, 400)
  }

  if (platform === 'netflix') {
    const url = new URL(req.url)
    const target = new URL('/api/ingest/netflix', url.origin)
    for (const [k, v] of searchParams.entries()) {
      if (k.toLowerCase() === 'platform') continue
      target.searchParams.set(k, v)
    }
    const res = await fetch(target.toString(), { method: 'GET' })
    const data = await res.json()
    return json(data, res.status)
  }

  return json({ error: `Platform not implemented: ${platform}` }, 501)
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
