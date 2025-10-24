import { env } from '../env.js'
import { getFeaturedAppIds, getAppDetails, AppDetails } from './steam.js'
import { loadJson, saveJson } from '../utils/fsStore.js'

export type CuratedItem = {
  appId: number
  title: string
  genres: string[]
  currency: string
  priceBaseCents: number
  priceFinalCents: number
  priceBase: number
  priceFinal: number
  discountPct: number
  score: number
  url: string
  coverUrl: string
}

export type CuratedFeed = { slotDate: string; items: CuratedItem[] }

const rotationPath = env.ROTATION_FILE
const rotationMemory: Record<number, string> = loadJson(rotationPath, {})
let currentFeed: CuratedFeed = { slotDate: new Date().toISOString(), items: [] }

function hoursAgo(h: number) {
  return Date.now() - h * 3600_000
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  // simple deterministic shuffle based on string seed
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    // linear congruential generator
    s = (1103515245 * s + 12345) & 0x7fffffff
    const j = s % (i + 1)
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function scoreItem(d: AppDetails, bestDiscountForApp: number, lastShownAtIso?: string): number {
  const p = d.price
  const discountScore = 0.7 * (p.discount_percent || 0)
  const priceRelScore = (p.initial && p.final <= 0.75 * p.initial) ? 15 : 0
  const recencyScore = 5 // featured proxy, slightly toned down
  const bestPriceBonus = (p.discount_percent >= bestDiscountForApp) ? 6 : 0
  let noveltyPenalty = 0
  if (lastShownAtIso) {
    const last = new Date(lastShownAtIso).getTime()
    if (Date.now() - last < env.CURATION_ROTATION_COOLDOWN_HOURS * 3600_000) {
      noveltyPenalty = -30
    }
  }
  return discountScore + priceRelScore + recencyScore + bestPriceBonus + noveltyPenalty
}

export async function buildCuratedFeed(): Promise<CuratedFeed> {
  const ids = await getFeaturedAppIds()
  const details: (AppDetails | null)[] = await Promise.all(ids.map(getAppDetails))
  let usable = details.filter((d): d is AppDetails => !!d && (d.price.discount_percent ?? 0) >= env.CURATION_MIN_DISCOUNT)
  // If no items pass the minimum discount, relax the constraint slightly to avoid empty feeds
  if (usable.length === 0) {
    const all = details.filter((d): d is AppDetails => !!d)
    // pick top discounted items even if below min threshold
    usable = all
      .sort((a, b) => (b.price.discount_percent || 0) - (a.price.discount_percent || 0))
      .slice(0, env.CURATION_FEED_SIZE * 2)
  }

  // Best discount per appId (usually unique, but keep logic)
  const bestDiscountMap = new Map<number, number>()
  for (const d of usable) {
    const best = bestDiscountMap.get(d.appId) || 0
    if ((d.price.discount_percent || 0) > best) bestDiscountMap.set(d.appId, d.price.discount_percent || 0)
  }

  // Score
  const scored = usable.map(d => {
    const lastShownAt = rotationMemory[d.appId]
    const score = scoreItem(d, bestDiscountMap.get(d.appId) || 0, lastShownAt)
    const priceBaseCents = d.price.initial ?? d.price.final
    const priceFinalCents = d.price.final
    const priceBase = priceBaseCents > 0 ? Number((priceBaseCents / 100).toFixed(2)) : 0
    const priceFinal = priceFinalCents > 0 ? Number((priceFinalCents / 100).toFixed(2)) : 0
    return {
      appId: d.appId,
      title: d.title,
      genres: d.genres,
      currency: d.price.currency,
      priceBaseCents,
      priceFinalCents,
      priceBase,
      priceFinal,
      discountPct: d.price.discount_percent || 0,
      score,
      url: `https://store.steampowered.com/app/${d.appId}/`,
      coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${d.appId}/header.jpg`
    } as CuratedItem
  })

  // Dedup: keep best score per appId
  const byApp = new Map<number, CuratedItem>()
  for (const it of scored) {
    const prev = byApp.get(it.appId)
    if (!prev || it.score > prev.score) byApp.set(it.appId, it)
  }
  const deduped = Array.from(byApp.values())
  deduped.sort((a, b) => b.score - a.score)

  // Diversity: limit max 50% to same primary genre (first genre if exists)
  const primaryCounts = new Map<string, number>()
  const maxPerGenre = Math.max(1, Math.floor(env.CURATION_FEED_SIZE * 0.4))
  const diverse: CuratedItem[] = []
  const slotSeed = new Date().toISOString().slice(0, 13) // hour-level stability
  const pool = seededShuffle(deduped.slice(0, env.CURATION_FEED_SIZE * 3), slotSeed)
  for (const it of pool) {
    const g = (it.genres && it.genres.length > 0) ? it.genres[0] : 'Desconhecido'
    const count = primaryCounts.get(g) || 0
    if (count < maxPerGenre) {
      diverse.push(it)
      primaryCounts.set(g, count + 1)
    }
    if (diverse.length >= env.CURATION_FEED_SIZE) break
  }

  const newFeed: CuratedFeed = { slotDate: new Date().toISOString(), items: diverse }
  // Do not overwrite currentFeed with empty items; keep last good feed
  if (newFeed.items.length > 0) {
    for (const it of newFeed.items) rotationMemory[it.appId] = newFeed.slotDate
    saveJson(rotationPath, rotationMemory)
    currentFeed = newFeed
  }
  return currentFeed
}

export function getCurrentFeed(): CuratedFeed {
  return currentFeed
}