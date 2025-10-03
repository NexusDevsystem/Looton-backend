import { env } from '../../env.js'
import { loadJson, saveJson } from '../../utils/fsStore.js'
import { PcOffer, PcFeed } from './types.js'

type RotationMemory = Record<string, { lastShownAt: string }>

let currentPcFeed: PcFeed = { slotDate: new Date(0).toISOString(), items: [] }
let lastBuildAt = 0

function normalizeText(s?: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
}

const _allowList = env.PC_ALLOW_KEYWORDS.split(',').map((s) => normalizeText(s.trim())).filter(Boolean)
const _blockList = env.PC_BLOCK_KEYWORDS.split(',').map((s) => normalizeText(s.trim())).filter(Boolean)

function isAllowedOffer(o: PcOffer): boolean {
  if (!env.PC_USE_KEYWORD_FILTER) return true
  const title = normalizeText(o.title)
  // explicit blocks win
  if (_blockList.some((b) => b && title.includes(b))) return false
  // must match at least one allowed keyword
  if (_allowList.length && ! _allowList.some((a) => a && title.includes(a))) return false
  return true
}

function keyFor(o: PcOffer): string {
  return o.ean || o.sku || o.url
}

function dedupeKeepBest(items: PcOffer[]): PcOffer[] {
  const map = new Map<string, PcOffer>()
  for (const it of items) {
    const k = keyFor(it)
    const prev = map.get(k)
    if (!prev) map.set(k, it)
    else {
      const a = prev.priceFinalCents
      const b = it.priceFinalCents
      if (b < a) map.set(k, it)
    }
  }
  return [...map.values()]
}

function clampDiversity(items: (PcOffer & { score: number })[]): (PcOffer & { score: number })[] {
  const byStore: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  const maxStore = Math.ceil(env.PC_CUR_FEED_SIZE * 0.8) // Aumentado de 60% para 80%
  const maxCat = Math.ceil(env.PC_CUR_FEED_SIZE * 0.7) // Aumentado de 50% para 70%
  const out: (PcOffer & { score: number })[] = []
  for (const it of items) {
    const s = it.store
    const c = it.category || 'uncat'
    const cs = byStore[s] || 0
    const cc = byCategory[c] || 0
    if (cs >= maxStore || cc >= maxCat) continue
    out.push(it)
    byStore[s] = cs + 1
    byCategory[c] = cc + 1
    if (out.length >= env.PC_CUR_FEED_SIZE) break
  }
  return out
}

function scoreItems(items: PcOffer[], rotation: RotationMemory): (PcOffer & { score: number })[] {
  const minPct = env.PC_CUR_MIN_DISCOUNT
  const now = Date.now()
  const arr = (items
    .filter((it) => it.priceFinalCents > 0 && it.url)
    .map((it) => {
      let discountPct = it.discountPct
      if (!discountPct && it.priceBaseCents && it.priceBaseCents > it.priceFinalCents) {
        discountPct = Math.round((1 - it.priceFinalCents / it.priceBaseCents) * 100)
      }
      if (!discountPct || discountPct < minPct) return null
      let score = 0.7 * discountPct
      if (it.availability === 'in_stock') score += 5
      score += 5 // recency bonus (all items are from this run)
      const k = keyFor(it)
      const last = rotation[k]?.lastShownAt ? Date.parse(rotation[k].lastShownAt) : 0
      if (last && now - last < env.PC_CUR_ROTATION_COOLDOWN_HOURS * 3600_000) {
        score -= 30
      }
      return { ...it, discountPct, score }
    })
    .filter(Boolean)) as (PcOffer & { score: number })[]
  return arr.sort((a, b) => b.score - a.score)
}

export async function rebuildPcFeed(connectors: Array<() => Promise<PcOffer[]>>): Promise<PcFeed> {
  const rotation = loadJson<RotationMemory>(env.PC_ROTATION_FILE, {})
  const collected: PcOffer[] = []
  for (const fn of connectors) {
    try {
      const part = await fn()
      console.log('[pc] connector returned', part?.length || 0, 'items')
      collected.push(...(part || []))
    } catch (e) {
      console.warn('pc connector error:', e)
    }
  }
  console.log('[pc] collected total:', collected.length)
  // filter only computer parts and peripherals
  const filtered = collected.filter(isAllowedOffer)
  console.log('[pc] after keyword filter:', filtered.length)
  if (filtered.length === 0 && collected.length > 0) {
    console.warn('[pc] WARNING: All products filtered out by keywords! Original count:', collected.length)
  }
  // freshness: only keep items from now-slot (they already are)
  const deduped = dedupeKeepBest(filtered)
  console.log('[pc] after dedupe:', deduped.length)
  let scored = scoreItems(deduped, rotation)
  console.log('[pc] after scoring (min discount check):', scored.length)
  if (deduped.length > 0 && scored.length === 0) {
    console.warn('[pc] WARNING: All products failed min discount requirement – relaxing filters for this run')
    // Relax min discount: compute score with whatever discount info exists
    scored = deduped
      .map((it) => {
        let discountPct = it.discountPct
        if (!discountPct && it.priceBaseCents && it.priceBaseCents > it.priceFinalCents) {
          discountPct = Math.round((1 - it.priceFinalCents / it.priceBaseCents) * 100)
        }
        let score = 0.7 * (discountPct || 0)
        if (it.availability === 'in_stock') score += 5
        score += 5
        const k = keyFor(it)
        const last = rotation[k]?.lastShownAt ? Date.parse(rotation[k].lastShownAt) : 0
        if (last && Date.now() - last < env.PC_CUR_ROTATION_COOLDOWN_HOURS * 3600_000) score -= 30
        return { ...it, discountPct, score }
      })
      .sort((a, b) => b.score - a.score)
  }
  if (scored.length === 0) {
    // if no items pass min discount, allow top discounted (up to feed size)
    scored = deduped
      .map((it) => {
        let discountPct = it.discountPct
        if (!discountPct && it.priceBaseCents && it.priceBaseCents > it.priceFinalCents) {
          discountPct = Math.round((1 - it.priceFinalCents / it.priceBaseCents) * 100)
        }
        let score = 0.7 * (discountPct || 0)
        if (it.availability === 'in_stock') score += 5
        score += 5
        const k = keyFor(it)
        const last = rotation[k]?.lastShownAt ? Date.parse(rotation[k].lastShownAt) : 0
        if (last && Date.now() - last < env.PC_CUR_ROTATION_COOLDOWN_HOURS * 3600_000) score -= 30
        return { ...it, discountPct, score }
      })
  .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
  }
  const diversified = clampDiversity(scored)
  console.log('[pc] diversified size:', diversified.length)
  if (diversified.length === 0 && scored.length > 0) {
    console.warn('[pc] WARNING: All products filtered out by diversity limits! Scored count:', scored.length)
  }
  const slotDate = new Date().toISOString()
  // update rotation
  for (const it of diversified) {
    const k = keyFor(it)
    rotation[k] = { lastShownAt: slotDate }
  }
  saveJson(env.PC_ROTATION_FILE, rotation)
  currentPcFeed = { slotDate, items: diversified.map(({ score, ...rest }) => rest) }
  lastBuildAt = Date.now()
  return currentPcFeed
}

export function getCurrentPcFeed(): PcFeed {
  // never serve older than current slot
  return currentPcFeed
}
