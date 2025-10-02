import { fetchRateLimited } from './http.js'
import { PcOffer, FetchOptions } from './types.js'
import { env } from '../../env.js'

// Enable logs with PC_DEBUG=1
const DEBUG = process.env.PC_DEBUG === '1'
const BASE = 'https://www.pichau.com.br'

function parseCurrencyBRLToCents(txt: string | number | null | undefined): number | undefined {
  if (txt === null || txt === undefined) return undefined
  if (typeof txt === 'number') return Math.round(txt * 100)
  const s = String(txt).replace(/\s/g, '')
  const m = s.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)/)
  if (!m) return undefined
  const norm = m[1].replace(/\./g, '').replace(',', '.')
  const v = Number(norm)
  return Number.isFinite(v) ? Math.round(v * 100) : undefined
}

function toAbs(url: string): string {
  try { return new URL(url, BASE).toString() } catch { return url }
}

type NextData = { pageProps?: { data?: any } }

async function tryJson<T>(p: Promise<Response>): Promise<T | null> {
  try {
    const res = await p
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('json')) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function pathFrom(urlOrPath: string): string {
  try {
    const u = new URL(urlOrPath)
    return u.pathname + u.search
  } catch {
    return urlOrPath
  }
}

async function fetchCategoryPageJson(pathOrUrl: string) {
  const path = pathFrom(pathOrUrl)
  const htmlRes = await fetchRateLimited(`${BASE}${path}`)
  if (!htmlRes.ok) return null
  const html = await htmlRes.text()
  const m = html.match(/\/_next\/data\/([^"']+)\.json/)
  if (!m) return null
  const dataUrl = `${BASE}/_next/data/${m[1]}.json`
  if (DEBUG) console.log('[pichau] next data url:', dataUrl)
  const json = await tryJson<NextData>(fetchRateLimited(dataUrl))
  return json?.pageProps?.data || null
}

function extractProductsFromState(state: any): Array<{ title?: string; url?: string; image?: string; price?: any; listPrice?: any; category?: any }> {
  const out: any[] = []
  const seen = new Set<any>()
  function walk(x: any) {
    if (!x || typeof x !== 'object' || seen.has(x)) return
    seen.add(x)
    if (Array.isArray(x)) { x.forEach(walk); return }
    const hasName = ('name' in x) || ('title' in x)
    const hasPrice = ('price' in x) || ('sellingPrice' in x) || ('priceValue' in x)
    const hasUrl = ('url' in x) || ('href' in x) || ('link' in x) || ('slug' in x)
    if (hasName && hasPrice && hasUrl) {
      out.push({
        title: x.title || x.name,
        url: x.url || x.href || x.link || (x.slug ? `${BASE}/${x.slug}` : undefined),
        image: x.image || x.thumbnail || x.img,
        price: x.price ?? x.sellingPrice ?? x.priceValue,
        listPrice: x.listPrice ?? x.highPrice,
        category: x.category?.name || x.category
      })
    }
    for (const k of Object.keys(x)) walk((x as any)[k])
  }
  walk(state)
  return out
}

async function parseAroundAnchors(html: string): Promise<PcOffer[]> {
  const items: PcOffer[] = []
  const re = /href=\s*["']((?:https?:\/\/www\.pichau\.com\.br)?\/[^"'\s#\?]+)["'][^>]*>([^<]{3,200})<\/a>/gi
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let url = m[1]
    url = toAbs(url)
    if (seen.has(url)) continue
    seen.add(url)
    const title = (m[2] || '').trim()
    const start = Math.max(0, m.index - 1200)
    const end = Math.min(html.length, m.index + 2000)
    const segment = html.slice(start, end)
    const image = (segment.match(/<img[^>]+src=\"([^\"]+)\"/i) || [])[1]
    const prices = [...segment.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(x => x[0])
    const toCents = (s?: string) => s ? parseCurrencyBRLToCents(s) : undefined
    const priceFinalCents = toCents(prices[prices.length - 1])
    const priceBaseCents = toCents(prices.length > 1 ? prices[prices.length - 2] : undefined)
    if (!priceFinalCents) continue
    const discountPct = priceBaseCents && priceBaseCents > priceFinalCents
      ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100))
      : undefined
    items.push({
      store: 'pichau',
      title: title || 'Produto',
      url,
      image,
      category: undefined,
      priceBaseCents: priceBaseCents && priceBaseCents > priceFinalCents ? priceBaseCents : undefined,
      priceFinalCents,
      discountPct,
      availability: 'unknown',
      sku: undefined,
      ean: undefined,
      updatedAt: new Date().toISOString()
    })
  }
  if (DEBUG) console.log('[pichau] anchors kept:', items.length)
  return items
}

function parseCategoryLdJsonOffers(html: string): PcOffer[] {
  const items: PcOffer[] = []
  const scripts = [...html.matchAll(/<script[^>]+type=\"application\/ld\+json\"[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1])
  for (const s of scripts) {
    try {
      const obj = JSON.parse(s)
      const list = Array.isArray(obj) ? obj : [obj]
      for (const entry of list) {
        // Category pages may embed OfferCatalog with itemListElement Products
        if (entry['@type'] === 'WebPage' && entry.mainEntity?.['@type'] === 'OfferCatalog') {
          const els = entry.mainEntity.itemListElement || []
          for (const prod of els) {
            if (prod['@type'] !== 'Product') continue
            const title = (prod.name || '').toString()
            const image = Array.isArray(prod.image) ? prod.image[0] : prod.image
            const url = toAbs(prod.url || prod.offers?.url || '')
            const pFinal = parseCurrencyBRLToCents(prod.offers?.price)
            const pBase = parseCurrencyBRLToCents(prod.offers?.highPrice || prod.offers?.priceSpecification?.price)
            if (!url || !pFinal) continue
            const discountPct = pBase && pBase > pFinal ? Math.max(0, Math.round((1 - pFinal / pBase) * 100)) : undefined
            items.push({
              store: 'pichau',
              title: title || 'Produto',
              url,
              image,
              category: prod.category,
              priceFinalCents: pFinal,
              priceBaseCents: pBase && pBase > pFinal ? pBase : undefined,
              discountPct,
              availability: /InStock/i.test(String(prod.offers?.availability)) ? 'in_stock' : 'unknown',
              updatedAt: new Date().toISOString()
            })
          }
        }
      }
    } catch {}
  }
  if (DEBUG && items.length) console.log('[pichau] category ld+json products:', items.length)
  return items
}

async function fetchProductLdJson(url: string): Promise<PcOffer | null> {
  try {
    const res = await fetchRateLimited(url)
    if (!res.ok) return null
    const html = await res.text()
    const scripts = [...html.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/gi)].map(m => m[1])
    for (const s of scripts) {
      try {
        const obj = JSON.parse(s)
        const arr = Array.isArray(obj) ? obj : [obj]
        const prod = arr.find(o => o['@type'] === 'Product' || String(o['@type']).includes('Product'))
        if (!prod) continue
        const offers = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers
        const title = prod.name
        const image = Array.isArray(prod.image) ? prod.image[0] : prod.image
        const price = offers?.price
        const base = offers?.highPrice || offers?.priceSpecification?.price
        const pFinal = parseCurrencyBRLToCents(price)
        if (!pFinal) continue
        const pBase = parseCurrencyBRLToCents(base)
        const discountPct = pBase && pBase > pFinal ? Math.max(0, Math.round((1 - pFinal / pBase) * 100)) : undefined
        return {
          store: 'pichau',
          title: (title || '').trim() || 'Produto',
          url,
          image,
          category: Array.isArray(prod.category) ? prod.category[0] : prod.category,
          priceFinalCents: pFinal,
          priceBaseCents: pBase && pBase > pFinal ? pBase : undefined,
          discountPct,
          availability: /InStock/i.test(String(offers?.availability)) ? 'in_stock' : 'unknown',
          updatedAt: new Date().toISOString()
        } as PcOffer
      } catch {}
    }
  } catch {}
  return null
}

export async function fetchDeals(opts: FetchOptions = {}): Promise<PcOffer[]> {
  try {
    const pages = [env.PCH_CATEGORY_URL, env.PCH_CATEGORY_URL_2].filter(Boolean)
    let collected: PcOffer[] = []

    for (const pageUrl of pages) {
      const state = await fetchCategoryPageJson(pageUrl)
      if (state) {
        const candidates = extractProductsFromState(state)
        if (DEBUG) console.log('[pichau] next-data candidates:', candidates.length)
        for (const c of candidates) {
          const url = c.url ? toAbs(c.url) : undefined
          const pFinal = parseCurrencyBRLToCents(c.price)
          const pBase = parseCurrencyBRLToCents(c.listPrice)
          if (!url || !pFinal) continue
          const discountPct = pBase && pBase > pFinal ? Math.max(0, Math.round((1 - pFinal / pBase) * 100)) : undefined
          collected.push({
            store: 'pichau',
            title: String(c.title || '').trim() || 'Produto',
            url,
            image: c.image,
            category: c.category,
            priceFinalCents: pFinal,
            priceBaseCents: pBase && pBase > pFinal ? pBase : undefined,
            discountPct,
            availability: 'unknown',
            updatedAt: new Date().toISOString()
          })
        }
      }

      if (collected.length < 12) {
        const res = await fetchRateLimited(pageUrl)
        if (res.ok) {
          const html = await res.text()
          const fromLd = parseCategoryLdJsonOffers(html)
          const fromAnchors = await parseAroundAnchors(html)
          collected.push(...fromLd, ...fromAnchors)
          const topLinks = fromAnchors.slice(0, 5).map((a) => a.url)
          for (const link of topLinks) {
            const real = await fetchProductLdJson(link)
            if (real) {
              const idx = collected.findIndex((x) => x.url === link)
              if (idx >= 0) collected[idx] = real
            }
          }
        }
      }

      await new Promise((r) => setTimeout(r, 600))
    }

    const map = new Map<string, PcOffer>()
    for (const it of collected) {
      const k = it.url
      const prev = map.get(k)
      if (!prev || it.priceFinalCents < prev.priceFinalCents) map.set(k, it)
    }
    const out = [...map.values()]

    if (DEBUG) console.log('[pichau] total kept:', out.length)
    const limit = opts.limit || 100
    return out.slice(0, limit)
  } catch (e) {
    if (DEBUG) console.error('[pichau] error:', e)
    return []
  }
}

export default { fetchDeals }
