import { env } from '../env.js'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'

type PriceOverview = {
  initial?: number
  final: number
  discount_percent: number
  currency: string
}

export type AppDetails = {
  appId: number
  title: string
  genres: string[]
  price: PriceOverview
}

const PRICE_TTL = ttlSecondsToMs(env.CACHE_TTL_SECONDS)
const priceCache = new MemoryCache<number, AppDetails>(PRICE_TTL)

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Looton/curator' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getFeaturedAppIds(): Promise<number[]> {
  const url = `https://store.steampowered.com/api/featuredcategories?cc=${env.CURATION_CC}&l=${env.CURATION_LANG}`
  const data = await fetchJson(url)
  const buckets: any[] = []
  const push = (arr: any) => { if (Array.isArray(arr)) buckets.push(arr) }
  push(data?.specials?.items || [])
  push(data?.top_sellers?.items || [])
  push(data?.new_releases?.items || [])
  push(data?.coming_soon?.items || [])
  // featured_win sometimes nests under items or large_capsules
  push(data?.featured_win?.items || [])
  push(data?.featured_win?.large_capsules || [])
  if (Array.isArray(data?.featured_win)) push(data?.featured_win)
  const ids = new Set<number>()
  for (const list of buckets) {
    for (const it of list) {
      const id = it?.id || it?.appId || it?.appid
      if (typeof id === 'number') ids.add(id)
    }
  }
  return Array.from(ids)
}

export async function getAppDetails(appId: number): Promise<AppDetails | null> {
  const hit = priceCache.get(appId)
  if (hit) return hit
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${env.CURATION_CC}&l=${env.CURATION_LANG}`
  const data = await fetchJson(url)
  const entry = data?.[appId]
  if (!entry?.success) return null
  const d = entry.data
  const genres = (d?.genres || []).map((g: any) => g?.description).filter(Boolean) as string[]
  const price = d?.price_overview as PriceOverview | undefined
  if (!price?.final) return null
  const details: AppDetails = {
    appId,
    title: d?.name || String(appId),
    genres,
    price: {
      initial: price.initial ?? price.final,
      final: price.final,
      discount_percent: price.discount_percent ?? 0,
      currency: price.currency || 'BRL'
    }
  }
  priceCache.set(appId, details)
  return details
}