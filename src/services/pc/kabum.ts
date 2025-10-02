import { fetchRateLimited } from './http.js'
import { PcOffer, FetchOptions } from './types.js'
import { env } from '../../env.js'

const DEBUG = process.env.PC_DEBUG === '1'

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

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseListing(html: string): PcOffer[] {
  const items: PcOffer[] = []
  // Anchor to product page (allow nested tags inside the anchor)
  const re = /<a[^>]+href\s*=\s*["']((?:https?:\/\/www\.kabum\.com\.br)?\/produto\/[^"'>\s]+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()
  while ((m = re.exec(html))) {
    const url = m[1]
    if (seen.has(url)) continue
    seen.add(url)
    const anchorInner = m[2] || ''
    // Prefer explicit attributes for title if present
    const anchorTagStart = html.lastIndexOf('<a', m.index)
    const anchorTag = html.slice(anchorTagStart, html.indexOf('>', anchorTagStart) + 1)
    const attrTitle = (anchorTag.match(/title=\"([^\"]+)\"/) || anchorTag.match(/aria-label=\"([^\"]+)\"/) || [])[1]
    const title = attrTitle || stripTags(anchorInner)
    const start = Math.max(0, m.index - 1500)
    const end = Math.min(html.length, m.index + 2200)
    const seg = html.slice(start, end)
    // Try capture image
    const image = (seg.match(/<img[^>]+src=\"([^\"]+)\"/i) || [])[1]
    // Prices appearing around the tile; collect and choose sensible base/final
    const prices = [...seg.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(x => x[0])
    const toCents = (s?: string) => s ? parseCurrencyBRLToCents(s) : undefined
    const priceFinalCents = toCents(prices[prices.length - 1])
    const priceBaseCents = toCents(prices.length > 1 ? prices[prices.length - 2] : undefined)
    if (!priceFinalCents) continue
    const discountPct = priceBaseCents && priceBaseCents > priceFinalCents
      ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100))
      : undefined
    items.push({
      store: 'kabum',
      title: (title && title.length > 2) ? title : 'Produto',
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

function parseNextDataProducts(html: string): PcOffer[] {
  const items: PcOffer[] = []
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return items
  try {
    const data = JSON.parse(m[1])
    const found: PcOffer[] = []
    const walk = (node: any) => {
      if (!node) return
      if (Array.isArray(node)) { for (const it of node) walk(it); return }
      if (typeof node === 'object') {
        const looksLike = ('name' in node || 'titulo' in node) && ('price' in node || 'preco' in node || 'valor' in node || 'preco_desconto' in node)
        const hasUrl = (node['url'] || node['link'] || node['slug'])
        if (looksLike && hasUrl) {
          const title = (node['name'] || node['titulo'] || '').toString()
          const urlPath = (node['url'] || node['link'] || node['slug'] || '').toString()
          const url = urlPath.startsWith('http') ? urlPath : `https://www.kabum.com.br${urlPath.startsWith('/') ? '' : '/'}${urlPath}`
          const image = (node['image'] || node['imagem'] || node['thumbnail'] || '') as string
          const priceFinalCents = parseCurrencyBRLToCents(node['preco_desconto'] || node['price'] || node['valor'])
          const priceBaseCents = parseCurrencyBRLToCents(node['preco'] || node['price_from'] || node['valor_de'])
          if (priceFinalCents) {
            found.push({
              store: 'kabum',
              title: title || 'Produto',
              url,
              image,
              category: undefined,
              priceBaseCents: priceBaseCents && priceBaseCents > priceFinalCents ? priceBaseCents : undefined,
              priceFinalCents,
              discountPct: priceBaseCents && priceBaseCents > 0 ? Math.max(0, Math.round((1 - priceFinalCents / priceBaseCents) * 100)) : undefined,
              availability: 'unknown',
              sku: undefined,
              ean: undefined,
              updatedAt: new Date().toISOString()
            })
          }
        }
        for (const k of Object.keys(node)) walk((node as any)[k])
      }
    }
    walk(data)
    if (found.length && DEBUG) console.log('[kabum] next-data products:', found.length)
    items.push(...found)
  } catch {}
  return items
}

export async function fetchDeals(opts: FetchOptions = {}): Promise<PcOffer[]> {
  try {
    // Try configured product listings pages (page 1 and 2)
    const pages = [env.KABUM_CATEGORY_URL, env.KABUM_CATEGORY_URL_2].filter(Boolean)
    let items: PcOffer[] = []
    for (const pageUrl of pages) {
      const res = await fetchRateLimited(pageUrl)
      if (!res.ok) continue
      const html = await res.text()
      const fromAnchors = parseListing(html)
      const fromNext = parseNextDataProducts(html)
      items.push(...fromAnchors, ...fromNext)
    }

    if (items.length === 0) {
      // Try Next.js data embedded
      // Fetch promotions page as fallback to extract embedded NEXT data
      const fallbackRes = await fetchRateLimited('https://www.kabum.com.br/promocoes')
      const html = fallbackRes.ok ? await fallbackRes.text() : ''
      const fromNext = parseNextDataProducts(html)
      if (fromNext.length) items = fromNext
    }
    // Dedup by URL and choose lowest price if duplicates
    const map = new Map<string, PcOffer>()
    for (const it of items) {
      const prev = map.get(it.url)
      if (!prev || it.priceFinalCents < prev.priceFinalCents) map.set(it.url, it)
    }
    items = [...map.values()]
    const limit = opts.limit || 40
    return items.slice(0, limit)
  } catch {
    return []
  }
}

export default { fetchDeals }
