import { FastifyInstance } from 'fastify'
import { getCurrentPcFeed, rebuildPcFeed } from '../services/pc/aggregate.js'
import * as terabyte from '../services/pc/terabyte.js'
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
      
      // Split tokens for individual processing
      const tokens = t.split(' ').filter(Boolean)
      for (const tok of tokens) {
        variants.add(tok)
      }
      
      // GPU Detection - 3-4 digit numbers (common in GPU models)
      const nums = t.match(/\b(\d{3,4})\b/g) || []
      for (const n of nums) {
        variants.add(n)
        // NVIDIA variants
        variants.add(`rtx ${n}`)
        variants.add(`geforce ${n}`)
        variants.add(`gtx ${n}`)
        variants.add(`rtx${n}`)
        variants.add(`gtx${n}`)
        variants.add(`nvidia ${n}`)
        // AMD variants
        variants.add(`rx ${n}`)
        variants.add(`radeon ${n}`)
        variants.add(`rx${n}`)
        variants.add(`amd ${n}`)
        // GPU suffixes
        const gpuSuff = ['ti', 'super', 'xt', 'xtx', 'gddr6', 'gddr6x']
        for (const sfx of gpuSuff) {
          variants.add(`${n} ${sfx}`)
          variants.add(`rtx ${n} ${sfx}`)
          variants.add(`gtx ${n} ${sfx}`)
          variants.add(`rx ${n} ${sfx}`)
        }
      }
      
      // CPU Detection - Intel patterns
      const intelMatch = t.match(/\b(i[3579])\b/g) || []
      for (const cpu of intelMatch) {
        variants.add(cpu)
        variants.add(`intel ${cpu}`)
        variants.add(`core ${cpu}`)
        variants.add(`processador ${cpu}`)
        // Common Intel generations
        const gens = ['10th', '11th', '12th', '13th', '14th']
        for (const gen of gens) {
          variants.add(`${cpu} ${gen}`)
          variants.add(`${gen} gen ${cpu}`)
        }
      }
      
      // CPU Detection - AMD Ryzen patterns
      if (t.includes('ryzen') || /\br[3579]\b/.test(t)) {
        variants.add('ryzen')
        variants.add('amd ryzen')
        variants.add('processador ryzen')
        const ryzenMatch = t.match(/\br([3579])\b/g) || []
        for (const r of ryzenMatch) {
          variants.add(`ryzen ${r}`)
          variants.add(`r${r}`)
          variants.add(`amd r${r}`)
        }
      }
      
      // Memory Detection
      if (t.includes('ddr') || t.includes('memoria') || t.includes('ram')) {
        variants.add('memoria')
        variants.add('memória')
        variants.add('ram')
        variants.add('ddr4')
        variants.add('ddr5')
        variants.add('memoria ram')
        variants.add('memória ram')
      }
      
      // Storage Detection
      if (t.includes('ssd') || t.includes('nvme') || t.includes('m.2')) {
        variants.add('ssd')
        variants.add('nvme')
        variants.add('m.2')
        variants.add('armazenamento')
        variants.add('disco')
        variants.add('storage')
      }
      
      // Motherboard Detection
      if (t.includes('placa') && (t.includes('mae') || t.includes('mãe')) || t.includes('motherboard')) {
        variants.add('placa mae')
        variants.add('placa mãe')
        variants.add('placa-mae')
        variants.add('motherboard')
        variants.add('placa de video') // avoid confusion
      }
      
      // Power Supply Detection
      if (t.includes('fonte') || t.includes('psu')) {
        variants.add('fonte')
        variants.add('psu')
        variants.add('fonte de alimentacao')
        variants.add('fonte de alimentação')
        variants.add('power supply')
      }
      
      // Case Detection
      if (t.includes('gabinete') || t.includes('case')) {
        variants.add('gabinete')
        variants.add('case')
        variants.add('tower')
        variants.add('caixa')
      }
      
      // Monitor Detection
      if (t.includes('monitor') || t.includes('display')) {
        variants.add('monitor')
        variants.add('display')
        variants.add('tela')
        variants.add('lcd')
        variants.add('led')
      }
      
      // Peripherals Detection
      if (t.includes('teclado') || t.includes('mouse') || t.includes('headset') || t.includes('fone')) {
        if (t.includes('teclado')) {
          variants.add('teclado')
          variants.add('keyboard')
          variants.add('teclado gamer')
        }
        if (t.includes('mouse')) {
          variants.add('mouse')
          variants.add('mouse gamer')
          variants.add('rato')
        }
        if (t.includes('headset') || t.includes('fone')) {
          variants.add('headset')
          variants.add('fone')
          variants.add('fone de ouvido')
          variants.add('headphone')
        }
      }
      
      return Array.from(variants).filter(Boolean)
    }
    const matchesSmart = (offer: PcOffer, query: string) => {
      const hay = normalize(`${offer.title} ${offer.category || ''} ${offer.sku || ''} ${offer.ean || ''}`)
      const qv = buildQueryVariants(query)
      if (qv.length === 0) return true
      // Require that at least one variant appears
      const matches = qv.some((v) => hay.includes(v))
      // Debug logging for search issues
      if (text && process.env.NODE_ENV === 'development') {
        console.log(`Search Debug - Query: "${query}"`)
        console.log(`Variants: [${qv.slice(0, 10).join(', ')}${qv.length > 10 ? '...' : ''}]`)
        console.log(`Product: "${offer.title}" - Matches: ${matches}`)
      }
      return matches
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
            // Only sort if not using offset (first page) - for better performance
            if (!offset) {
              items.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))
            }
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
        let items = cached.payload.items;
        if (text) {
          // Apply text search filter to cached items for better performance
          items = items.filter((it) => matchesSmart(it, text))
        }
        // Apply pagination after filtering
        if (offset) items = items.slice(offset)
        if (limit) items = items.slice(0, limit)
        return reply.send({ ...cached.payload, items })
      }
      const map: Record<string, (o?: any) => Promise<PcOffer[]>> = {
        terabyte: (o?: any) => terabyte.fetchDeals(o)
      }
      const selected = (stores.length ? stores : Object.keys(map)).filter((s) => map[s])
      const raw: PcOffer[] = []
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
      // sort by discount desc if available, but only if no offset (first page) for performance
      if (!offset) {
        items.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))
      }
      if (offset) items = items.slice(offset)
      if (limit) items = items.slice(0, limit)
      const payload = { slotDate: new Date().toISOString(), items }
      fullCache.set(cacheKey, { at: Date.now(), payload })
      return reply.send(payload)
    }
    if (q.refresh === '1' || q.refresh === 1) {
      try {
        await rebuildPcFeed([
          () => terabyte.fetchDeals({ limit: 50 })
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
