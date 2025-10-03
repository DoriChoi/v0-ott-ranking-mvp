import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const map: Map<string, { count: number; lastAt: number }> = (global as any).__v0_tmdb_miss_map || new Map()
    const arr = Array.from(map.entries())
      .map(([title, v]) => ({ title, count: v.count, lastAt: new Date(v.lastAt).toISOString() }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ misses: arr })
  } catch (e) {
    return NextResponse.json({ misses: [], error: (e as Error).message }, { status: 500 })
  }
}
