import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'
export interface ConsolidatedDeal {
  id: string // app:123 | package:456 | bundle:789
  title: string
  slug: string
  coverUrl?: string
  genres?: string[]
  tags?: string[]
  kind: 'game' | 'dlc' | 'package' | 'bundle'
  isFree?: boolean
  baseGameTitle?: string
  currency?: string
  stores: Array<{
    store: 'steam'
    storeAppId: string // somente o número
    url: string
    priceBase?: number
    priceFinal?: number
    discountPct?: number
    isActive: boolean
  }>
  bestPrice: {
    store: string
    price?: number
    discountPct?: number
  }
  totalStores: number
}

// Cache normalizado por cc/l (5 minutos)
const normalizedCache = new MemoryCache<string, ConsolidatedDeal[]>(ttlSecondsToMs(300))

function cacheKey(cc: string, l: string) {
  return `${cc}|${l}`.toLowerCase()
}

async function fetchSpecials(cc: string, l: string) {
  const url = `https://store.steampowered.com/api/featuredcategories?cc=${cc}&l=${l}`
  const res = await fetch(url)
  if (!res.ok) return [] as any[]
  const json = await res.json()
  const items: any[] = json?.specials?.items ?? []
  return items
}

function centsToUnit(n?: number) { return typeof n === 'number' ? Math.round(n) / 100 : undefined }
function clampPct(n?: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return undefined
  return Math.max(0, Math.min(100, Math.round(n)))
}

type Normalized = {
  kind: 'game'|'dlc'|'package'|'bundle'
  id: string
  title: string
  coverUrl?: string
  url: string
  priceOriginalCents?: number
  priceFinalCents?: number
  discountPct?: number
  currency?: string
  isFree?: boolean
  baseGameTitle?: string
  tags?: string[]
}

async function resolveApp(appid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${appid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(appid)]
  if (!node?.success) return undefined
  const d = node.data
  const type = (d?.type as string) || 'game'
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/app/${appid}/`
  
  // Extract genres and categories from Steam API
  const genres = (d?.genres || []).map((g: any) => g?.description || '').filter(Boolean)
  const categories = (d?.categories || []).map((c: any) => c?.description || '').filter(Boolean)
  const allTags = [...new Set([...genres, ...categories])]

  if (type === 'game') {
    if (d?.is_free || !d?.price_overview) {
      return { kind: 'game', id: `app:${appid}`, title, coverUrl: header, url, isFree: true, tags: allTags }
    }
    const pov = d.price_overview
    const currency = pov?.currency as string | undefined
    return {
      kind: 'game',
      id: `app:${appid}`,
      title,
      coverUrl: header,
      url,
      priceOriginalCents: pov?.initial,
      priceFinalCents: pov?.final,
      discountPct: pov?.discount_percent,
      currency,
      tags: allTags
    }
  }

  if (type === 'dlc') {
    const pov = d?.price_overview
    const currency = pov?.currency as string | undefined
    const baseGameTitle = d?.fullgame?.name as string | undefined
    return {
      kind: 'dlc',
      id: `app:${appid}`,
      title,
      coverUrl: header,
      url,
      priceOriginalCents: pov?.initial,
      priceFinalCents: pov?.final,
      discountPct: pov?.discount_percent,
      currency,
      baseGameTitle,
      tags: allTags
    }
  }

  // Outros tipos tratados como app comum
  const pov = d?.price_overview
  const currency = pov?.currency as string | undefined
  return {
    kind: 'game',
    id: `app:${appid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: pov?.initial,
    priceFinalCents: pov?.final,
    discountPct: pov?.discount_percent,
    currency,
    tags: allTags
  }
}

async function resolvePackage(packageid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/packagedetails/?packageids=${packageid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(packageid)]
  if (!node?.success) return undefined
  const d = node.data
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/sub/${packageid}/`
  const price = d?.price
  return {
    kind: 'package',
    id: `package:${packageid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: price?.initial,
    priceFinalCents: price?.final,
    discountPct: price?.discount_percent,
    currency: price?.currency
  }
}

async function resolveBundle(bundleid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/bundledetails/?bundleids=${bundleid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(bundleid)]
  if (!node?.success) return undefined
  const d = node.data
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/bundle/${bundleid}/`
  const price = d?.price
  return {
    kind: 'bundle',
    id: `bundle:${bundleid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: price?.initial,
    priceFinalCents: price?.final,
    discountPct: price?.discount_percent,
    currency: price?.currency
  }
}

export async function fetchConsolidatedDeals(limit: number = 50, opts?: { cc?: string; l?: string }): Promise<ConsolidatedDeal[]> {
  const cc = (opts?.cc || 'BR').toUpperCase()
  const l = opts?.l || 'pt-BR'
  const ckey = cacheKey(cc, l)

  const cached = normalizedCache.get(ckey)
  if (cached) return cached.slice(0, limit)

  try {
    const specials = await fetchSpecials(cc, l)
    // Ordena por desconto desc para priorizar os melhores
    specials.sort((a: any, b: any) => (b?.discount_percent || 0) - (a?.discount_percent || 0))

    // Resolve detalhes com limite para manter leve
    const pool = specials.slice(0, Math.min(120, specials.length))
    const resolved: Normalized[] = []
    for (const s of pool) {
      // resolve como app/package/bundle
      const id = Number(s?.id)
      if (!Number.isFinite(id)) continue

      const tryApp = await resolveApp(id, cc, l)
      if (tryApp) { resolved.push(tryApp); continue }
      const tryPkg = await resolvePackage(id, cc, l)
      if (tryPkg) { resolved.push(tryPkg); continue }
      const tryBun = await resolveBundle(id, cc, l)
      if (tryBun) { resolved.push(tryBun); continue }
    }

    // Filtros de acordo com as regras
    const filtered = resolved.filter(r => {
      if (r.kind === 'game' && r.isFree) return true // F2P sem preço
      // Pago precisa ter preço e desconto > 0
      return typeof r.priceOriginalCents === 'number' && typeof r.priceFinalCents === 'number' && (r.discountPct || 0) > 0
    })

    // Deduplicar por id (não misturar base/DLC/pacote)
    const uniq = new Map<string, Normalized>()
    for (const r of filtered) {
      if (!uniq.has(r.id)) uniq.set(r.id, r)
    }

    // Ordenar por desconto desc e preço final asc (quando houver)
    const ordered = Array.from(uniq.values()).sort((a, b) => {
      const da = a.discountPct || 0
      const db = b.discountPct || 0
      if (db !== da) return db - da
      const fa = typeof a.priceFinalCents === 'number' ? a.priceFinalCents : Number.MAX_SAFE_INTEGER
      const fb = typeof b.priceFinalCents === 'number' ? b.priceFinalCents : Number.MAX_SAFE_INTEGER
      return fa - fb
    })

    // Mapear para ConsolidatedDeal
    const consolidated: ConsolidatedDeal[] = ordered.map(n => {
      const slug = n.title.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '')
      const priceBase = centsToUnit(n.priceOriginalCents)
      const priceFinal = centsToUnit(n.priceFinalCents)
      const discount = clampPct(n.discountPct)
      const numericId = n.id.split(':')[1] || n.id
      const isFree = n.kind === 'game' && !!n.isFree
      return {
        id: n.id,
        title: n.title,
        slug,
        coverUrl: n.coverUrl,
        genres: n.tags || [],
        tags: n.tags || [],
        kind: n.kind,
        isFree,
        baseGameTitle: n.baseGameTitle,
        currency: n.currency,
        stores: [{
          store: 'steam',
          storeAppId: numericId,
          url: n.url,
          priceBase: isFree ? 0 : priceBase,
          priceFinal: isFree ? 0 : priceFinal,
          discountPct: isFree ? 0 : discount,
          isActive: true
        }],
        bestPrice: {
          store: 'steam',
          price: isFree ? 0 : priceFinal,
          discountPct: isFree ? 0 : discount
        },
        totalStores: 1
      }
    })

    if (consolidated.length > 0) normalizedCache.set(ckey, consolidated)

    return consolidated.slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar deals consolidadas:', error)
    return []
  }
}
