import { FastifyInstance } from 'fastify'
import { getCurrentPcFeed, rebuildPcFeed } from '../services/pc/aggregate.js'
import * as pichau from '../services/pc/pichau.js'
import * as terabyte from '../services/pc/terabyte.js'
import * as kabum from '../services/pc/kabum.js'
import type { PcOffer } from '../services/pc/types.js'
import { env } from '../env.js'

const fullCache = new Map<string, { at: number; payload: { slotDate: string; items: PcOffer[] } }>()

export default async function pcRoutes(app: FastifyInstance) {
  app.get('/pc-deals', async (req, reply) => {
    const q = req.query as any
    const limit = Math.min(200, Number(q.limit) || undefined || 40)
    const stores = typeof q.store === 'string' ? (q.store as string).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : []
    const categories = typeof q.category === 'string' ? (q.category as string).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : []
  const full = q.full === '1' || q.full === 1 || q.curated === '0'
  const offset = Math.max(0, Number((q as any).offset) || 0)
    const text = typeof q.q === 'string' ? String(q.q).trim() : ''

    // Smart search helpers (normalize + variants like 2060 -> rtx 2060/geforce 2060/rx 6600/radeon 6600)
    const normalize = (s?: string) => (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
    const buildQueryVariants = (input: string): string[] => {
      const t = normalize(input)
      if (!t) return []
      const variants = new Set<string>()
      variants.add(t)
      variants.add(t.replace(/\s+/g, ''))
      // Split tokens
      const tokens = t.split(' ').filter(Boolean)
      for (const tok of tokens) {
        variants.add(tok)
      }
      // Extract 3-4 digit numbers (common in GPU/CPU models)
      const nums = t.match(/\b(\d{3,4})\b/g) || []
      for (const n of nums) {
        variants.add(n)
        variants.add(`rtx ${n}`)
        variants.add(`geforce ${n}`)
        variants.add(`rtx${n}`)
        variants.add(`rx ${n}`)
        variants.add(`radeon ${n}`)
        variants.add(`rx${n}`)
      }
      // Common suffixes
      const suff = ['ti', 'super', 'xt', 'gddr6', 'gddr6x']
      for (const n of nums) {
        for (const sfx of suff) {
          variants.add(`${n} ${sfx}`)
          variants.add(`rtx ${n} ${sfx}`)
          variants.add(`rx ${n} ${sfx}`)
        }
      }
      return Array.from(variants).filter(Boolean)
    }
    const matchesSmart = (offer: PcOffer, query: string) => {
      const hay = normalize(`${offer.title} ${offer.category || ''} ${offer.sku || ''} ${offer.ean || ''}`)
      const qv = buildQueryVariants(query)
      if (qv.length === 0) return true
      // Require that at least one variant appears
      return qv.some((v) => hay.includes(v))
    }

    // Raw mode: fetch directly from connectors, no curation/size clamp
    if (full) {
      // If a search query is present, prefer calling store-specific search to avoid fetching all and filtering client-side
      if (text) {
        // Currently implemented for Terabyte only
        const wantsTerabyteOnly = stores.length === 0 || (stores.length === 1 && stores[0] === 'terabyte')
        if (wantsTerabyteOnly) {
          try {
            // Simple pagination by offset on top of concat pages from fetchSearch
            const pageSize = Math.min(120, limit || 60)
            const res = await terabyte.fetchSearch({ q: text, limit: offset ? offset + pageSize : pageSize })
            let items = res || []
            if (offset) items = items.slice(offset)
            if (limit) items = items.slice(0, limit)
            return reply.send({ slotDate: new Date().toISOString(), items })
          } catch (e) {
            req.log.warn({ err: e }, 'terabyte search failed')
            return reply.send({ slotDate: new Date().toISOString(), items: [] })
          }
        }
        // For other stores in future, fallback to raw fetch + text filter
      }
      const cacheKey = JSON.stringify({ stores, categories, limit, full: true })
      const cached = fullCache.get(cacheKey)
      if (cached && Date.now() - cached.at < env.PC_FULL_CACHE_TTL_SECONDS * 1000) {
        return reply.send(cached.payload)
      }
      const map: Record<string, (o?: any) => Promise<PcOffer[]>> = {
        pichau: (o?: any) => pichau.fetchDeals(o),
        terabyte: (o?: any) => terabyte.fetchDeals(o),
        kabum: (o?: any) => kabum.fetchDeals(o)
      }
      const selected = (stores.length ? stores : Object.keys(map)).filter((s) => map[s])
      let raw: PcOffer[] = []
      for (const s of selected) {
        try {
          const part = await map[s]({ limit: Number(q.limit) || 500 })
          raw.push(...(part || []))
        } catch (e) {
          req.log.warn({ err: e, store: s }, 'pc full mode connector error')
        }
      }
      // dedupe by ean/sku/url keeping best price
      const keyFor = (o: PcOffer) => o.ean || o.sku || o.url
      const seen = new Map<string, PcOffer>()
      for (const it of raw) {
        const k = keyFor(it)
        const prev = seen.get(k)
        if (!prev || it.priceFinalCents < prev.priceFinalCents) seen.set(k, it)
      }
      let items = Array.from(seen.values())
      if (stores.length) items = items.filter((it) => stores.includes(it.store.toLowerCase()))
      if (categories.length) items = items.filter((it) => (it.category ? categories.includes((it.category || '').toLowerCase()) : false))
      if (text) {
        items = items.filter((it) => matchesSmart(it, text))
      }
      // sort by discount desc if available
      items.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))
  if (offset) items = items.slice(offset)
  if (limit) items = items.slice(0, limit)
      const payload = { slotDate: new Date().toISOString(), items }
      fullCache.set(cacheKey, { at: Date.now(), payload })
      return reply.send(payload)
    }
    if (q.refresh === '1' || q.refresh === 1) {
      try {
        await rebuildPcFeed([
          () => pichau.fetchDeals({ limit: 50 }),
          () => terabyte.fetchDeals({ limit: 50 }),
          () => kabum.fetchDeals({ limit: 50 })
        ])
      } catch (e) {
        req.log.warn({ err: e }, 'failed manual pc rebuild')
      }
    }
    const feed = getCurrentPcFeed()
    let items = feed.items
    if (stores.length) items = items.filter((it) => stores.includes(it.store.toLowerCase()))
    if (categories.length) items = items.filter((it) => (it.category ? categories.includes(it.category.toLowerCase()) : false))
    if (text) {
      items = items.filter((it) => matchesSmart(it, text))
    }
    if (limit) items = items.slice(0, limit)
    return reply.send({ slotDate: feed.slotDate, items })
  })
}
