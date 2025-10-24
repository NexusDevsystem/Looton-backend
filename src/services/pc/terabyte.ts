import { fetchRateLimited } from './http.js'
import { PcOffer, FetchOptions } from './types.js'
import { env } from '../../env.js'

function parseCurrencyBRLToCents(txt: string | number | null | undefined): number | undefined {
  if (txt === null || txt === undefined) return undefined
  if (typeof txt === 'number') return Math.round(txt * 100)
  const s = String(txt).replace(/\s/g, '')
  const m = s.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:,\d{2})?)/)
  if (!m) return undefined
  const norm = m[1].replace(/\./g, '').replace(',', '.')
  const v = Number(norm)
  if (Number.isFinite(v)) return Math.round(v * 100)
  return undefined
}

function extractJsonLd(html: string): any[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const arr: any[] = []
  for (const m of scripts) {
    try {
      const json = JSON.parse(m[1].trim())
      if (Array.isArray(json)) arr.push(...json)
      else arr.push(json)
    } catch (e) { void e }
  }
  return arr
}

function extractMeta(html: string, name: string, attr: 'property' | 'name' = 'property'): string | undefined {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  const m = html.match(re)
  return m ? m[1] : undefined
}

async function fetchPromoListingUrls(): Promise<string[]> {
  const res = await fetchRateLimited(env.TBT_CATEGORY_URL)
  if (!res.ok) return []
  const html = await res.text()
  const hrefs = [...html.matchAll(/href=\s*["']((?:https?:\/\/www\.terabyteshop\.com\.br)?\/produto\/[^"]+)["']/g)].map((m) => m[1].startsWith('http') ? m[1] : `https://www.terabyteshop.com.br${m[1]}`)
  // unique
  return Array.from(new Set(hrefs)).slice(0, 24)
}

async function fetchManyListingPages(): Promise<string[]> {
  // Build a list of listing page URLs to visit: default two env pages + optional deep seeds with pagination
  const seeds: string[] = [env.TBT_CATEGORY_URL, env.TBT_CATEGORY_URL_2].filter(Boolean)
  const extra = (env.TBT_DEEP_SEEDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  seeds.push(...extra)
  const pages: string[] = []
  for (const s of seeds) {
    const hasPag = /[?&]pagina=\d+/i.test(s)
    if (hasPag) {
      const url = new URL(s)
      for (let i = 1; i <= Math.max(1, env.TBT_MAX_PAGES); i++) {
        url.searchParams.set('pagina', String(i))
        pages.push(url.toString())
      }
    } else {
      pages.push(s)
    }
  }
  // de-dup
  return Array.from(new Set(pages))
}

function parseListingOffers(html: string): PcOffer[] {
  // Parse product tiles from the listing page to avoid per-product requests
  const items: PcOffer[] = []
  const blocks = html.split(/<article|<div[^>]+class="product-item"/i)
  
  // Função auxiliar para selecionar preços base e final
  function selectBaseAndFinal(segment: string) {
    // Find all prices with context, then filter out installments like "10x de R$ 199,99"
    const matches = [...segment.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(m => ({
      text: m[0],
      index: m.index ?? 0
    }))
    const filtered: number[] = []
    for (const p of matches) {
      const start = Math.max(0, p.index - 24)
      const end = Math.min(segment.length, (p.index ?? 0) + p.text.length + 24)
      const ctx = segment.slice(start, end)
      // Heuristics to exclude installments: "10x", "x de", "vezes", "parcela", "parcelado", "sem juros"
      const isInstallment = /(\d+\s*x\s*de)|\bx\s*de\b|vezes|parcel|sem\s+juros/i.test(ctx)
      if (!isInstallment) {
        const cents = parseCurrencyBRLToCents(p.text)
        if (cents) filtered.push(cents)
      }
    }
    if (filtered.length === 0) {
      // fallback to naive last/prev rule
      const prices = matches.map(x => x.text)
      const toCents = (s?: string) => s ? parseCurrencyBRLToCents(s) : undefined
      const finalCents = toCents(prices[prices.length - 1])
      const baseCents = toCents(prices.length > 1 ? prices[prices.length - 2] : undefined)
      return { finalCents, baseCents }
    }
    // Among remaining prices, assume base = highest (original), final = lowest (discount/pix)
    filtered.sort((a,b) => a-b)
    const finalCents = filtered[0]
    const baseCents = filtered[filtered.length - 1]
    return { finalCents, baseCents }
  }
  
  for (const block of blocks) {
    // URL
    const url = (block.match(/href="(https:\/\/www\.terabyteshop\.com\.br\/produto\/[^"]+)"/) || [])[1]
    if (!url) continue
    // Title
    const title = (block.match(/title="([^\"]+)"/) || block.match(/class="prod-name[^\"]*">\s*([^<]+)\s*</i) || [])[1]
    // Image
    const image = (block.match(/<img[^>]+src="([^\"]+)"/i) || [])[1]
    // Prices: ignore installments and map base (original) vs final (com desconto)
    const { finalCents: priceFinalCents, baseCents: priceBaseCents } = selectBaseAndFinal(block)
    if (!priceFinalCents) continue
    const discountPct = priceBaseCents && priceBaseCents > priceFinalCents
      ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100))
      : undefined
    items.push({
      store: 'terabyte',
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
  return items
}

function parseAroundAnchorOffers(html: string): PcOffer[] {
  const items: PcOffer[] = []
  const re = /href="(https:\/\/www\.terabyteshop\.com\.br\/produto\/[^"]+)"[^>]*>([^<]{3,200})<\/a>/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()
  while ((m = re.exec(html))) {
    const url = m[1]
    if (seen.has(url)) continue
    seen.add(url)
    const title = m[2].trim()
    const start = Math.max(0, m.index - 1200)
    const end = Math.min(html.length, m.index + 2000)
    const seg = html.slice(start, end)
    // Use the same selection logic as listing
    const matches = [...seg.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(mm => ({ text: mm[0], index: mm.index ?? 0 }))
    const filtered: number[] = []
    for (const p of matches) {
      const pStart = Math.max(0, p.index - 24)
      const pEnd = Math.min(seg.length, p.index + p.text.length + 24)
      const ctx = seg.slice(pStart, pEnd)
      const isInstallment = /(\d+\s*x\s*de)|\bx\s*de\b|vezes|parcel|sem\s+juros/i.test(ctx)
      if (!isInstallment) {
        const cents = parseCurrencyBRLToCents(p.text)
        if (cents) filtered.push(cents)
      }
    }
    let priceFinalCents: number | undefined
    let priceBaseCents: number | undefined
    if (filtered.length > 0) {
      filtered.sort((a,b) => a-b)
      priceFinalCents = filtered[0]
      priceBaseCents = filtered[filtered.length - 1]
    } else {
      const prices = matches.map(x => x.text)
      const toCents = (s?: string) => s ? parseCurrencyBRLToCents(s) : undefined
      priceFinalCents = toCents(prices[prices.length - 1])
      priceBaseCents = toCents(prices.length > 1 ? prices[prices.length - 2] : undefined)
    }
    if (!priceFinalCents) continue
    const discountPct = priceBaseCents && priceBaseCents > priceFinalCents
      ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100))
      : undefined
    items.push({
      store: 'terabyte',
      title: title || 'Produto',
      url,
      image: undefined,
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
  return items
}

export async function fetchDeals(opts: FetchOptions = {}): Promise<PcOffer[]> {
  try {
    // First, try to parse offers directly from many listing pages (promos and deep seeds)
    const pages = await fetchManyListingPages()
    const collected: PcOffer[] = []
    for (const pageUrl of pages) {
      const res = await fetchRateLimited(pageUrl)
      if (!res.ok) continue
      const html = await res.text()
      let fromListing = parseListingOffers(html)
      if (fromListing.length === 0) fromListing = parseAroundAnchorOffers(html)
      collected.push(...fromListing)
    }

    if (collected.length > 0) {
      // Enriquecer os primeiros itens usando ld+json da página do produto para corrigir base/final
      const top = collected.slice(0, Math.min(10, collected.length))
      for (let i = 0; i < top.length; i++) {
        try {
              const r = await fetchRateLimited(top[i].url)
              if (!r.ok) continue
              const h = await r.text()
              const blocks = extractJsonLd(h)
              const products = blocks.filter((b) => (b['@type'] === 'Product' || (Array.isArray(b['@type']) && b['@type'].includes('Product'))))
              const p = products[0]
              if (!p) continue
              const offersNode = p.offers || {}
              const finalCents = parseCurrencyBRLToCents(offersNode.price || offersNode.lowPrice)
              const baseCents = parseCurrencyBRLToCents(offersNode.highPrice || offersNode.priceSpecification?.price || undefined)
              if (finalCents) {
                top[i].priceFinalCents = finalCents
                top[i].priceBaseCents = baseCents && baseCents > finalCents ? baseCents : undefined
                const pb = top[i].priceBaseCents
                const pf = top[i].priceFinalCents
                if (typeof pb === 'number' && typeof pf === 'number') {
                  top[i].discountPct = Math.max(0, Math.round((1 - pf / pb) * 100))
                } else {
                  top[i].discountPct = undefined
                }
              }
            } catch (e) { void e }
      }
      // write back enriched items
      for (let i = 0; i < top.length; i++) collected[i] = top[i]
      // dedupe by url
      const seen = new Set<string>()
      const uniq: PcOffer[] = []
      for (const it of collected) { if (!seen.has(it.url)) { seen.add(it.url); uniq.push(it) } }
      const limit = opts.limit || 500
      return uniq.slice(0, limit)
    }

    // Fallback: visit a subset of product pages and extract JSON-LD
  const urls = await fetchPromoListingUrls()
  const offers: PcOffer[] = []
  const limit = Math.min(opts.limit || 100, urls.length)
    for (let i = 0; i < limit; i++) {
      const url = urls[i]
      const r = await fetchRateLimited(url)
      if (!r.ok) continue
      const h = await r.text()
      let added = 0
      const blocks = extractJsonLd(h)
      const products = blocks.filter((b) => (b['@type'] === 'Product' || (Array.isArray(b['@type']) && b['@type'].includes('Product'))))
  for (const p of products) {
        const name: string = p.name || p.title
        const image: string | undefined = Array.isArray(p.image) ? p.image[0] : p.image
        const sku: string | undefined = p.sku
        const ean: string | undefined = p.gtin13 || p.gtin
        const category: string | undefined = p.category
        const offersNode = p.offers || {}
        const priceFinalCents = parseCurrencyBRLToCents(offersNode.price || offersNode.lowPrice)
        const priceBaseCents = parseCurrencyBRLToCents(offersNode.highPrice || offersNode.priceSpecification?.price || undefined)
        const availability: string | undefined = offersNode.availability || offersNode.itemCondition
        if (!priceFinalCents) continue
        offers.push({
          store: 'terabyte',
          title: name || 'Produto',
          url,
          image,
          category,
          priceBaseCents: priceBaseCents && priceBaseCents > priceFinalCents ? priceBaseCents : undefined,
          priceFinalCents,
          discountPct: priceBaseCents && priceBaseCents > 0 ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100)) : undefined,
          availability: /InStock/i.test(String(availability)) ? 'in_stock' : 'unknown',
          sku,
          ean,
          updatedAt: new Date().toISOString()
        })
        added++
      }
      if (added === 0) {
        // Fallback to meta tags when JSON-LD missing
        const name = extractMeta(h, 'og:title') || extractMeta(h, 'twitter:title', 'name')
        const image = extractMeta(h, 'og:image') || extractMeta(h, 'twitter:image', 'name')
        const priceStr = extractMeta(h, 'product:price:amount') || extractMeta(h, 'og:price:amount')
        const priceFinalCents = parseCurrencyBRLToCents(priceStr || '')
        if (priceFinalCents) {
          offers.push({
            store: 'terabyte',
            title: name || 'Produto',
            url,
            image,
            category: undefined,
            priceBaseCents: undefined,
            priceFinalCents,
            discountPct: undefined,
            availability: 'unknown',
            sku: undefined,
            ean: undefined,
            updatedAt: new Date().toISOString()
          })
        }
      }
    }
    return offers
  } catch {
    return []
  }
}

export async function fetchSearch(opts: FetchOptions & { q?: string } = {}): Promise<PcOffer[]> {
  try {
    const q = (opts.q || '').trim()
    if (!q) return []
    const tpl = env.TBT_SEARCH_URL || 'https://www.terabyteshop.com.br/busca?str={q}&pagina=1'
    const maxPages = Math.max(1, env.TBT_SEARCH_MAX_PAGES || 1)
    const pages: string[] = []
    // If template has {q}, replace; otherwise append str param
    const firstUrl = tpl.includes('{q}') ? tpl.replace('{q}', encodeURIComponent(q)) : `${tpl}${tpl.includes('?') ? '&' : '?'}str=${encodeURIComponent(q)}`
    const hasPag = /[?&]pagina=\d+/i.test(firstUrl)
    if (hasPag) {
      const url = new URL(firstUrl)
      for (let i = 1; i <= maxPages; i++) { url.searchParams.set('pagina', String(i)); pages.push(url.toString()) }
    } else {
      pages.push(firstUrl)
    }
    const collected: PcOffer[] = []
    for (const u of pages) {
      const res = await fetchRateLimited(u)
      if (!res.ok) continue
      const html = await res.text()
      let part = parseListingOffers(html)
      if (part.length === 0) part = parseAroundAnchorOffers(html)
      collected.push(...part)
    }
    // de-dup by url and clamp
    const seen = new Set<string>()
    const out: PcOffer[] = []
    for (const it of collected) { if (!seen.has(it.url)) { seen.add(it.url); out.push(it) } }
    const limit = opts.limit || 60
    return out.slice(0, limit)
  } catch {
    return []
  }
}

export default { fetchDeals, fetchSearch }