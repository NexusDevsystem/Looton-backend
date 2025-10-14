import { getDailySteamDeals, clearDailyDealsCache } from '../services/daily-steam-deals.service.js'
import { getPermanentDeals, clearPermanentDealsCache } from '../services/permanent-deals-cache.service.js'

export default async function feedRoutes(app: any) {
  app.get('/feed', async (req: any, res: any) => {
    const query = req.query as Record<string, string | undefined>
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '30'), 10)))
    const forceRefresh = (query.refresh === 'true') || (query.refresh === '1')

    try {
      if (forceRefresh) {
        clearDailyDealsCache?.()
        clearPermanentDealsCache?.()
      }

      let deals = await getDailySteamDeals()

      if (!deals || deals.length === 0) {
        deals = getPermanentDeals()
      }

      // Dedupe
      const seen = new Set<string>()
      const uniq: any[] = []
      for (const d of deals || []) {
        // OfferDTO uses storeAppId as primary identifier; fall back to title if missing
        const key = d.storeAppId || d.title
        if (!key) continue
        if (!seen.has(key)) {
          seen.add(key)
          uniq.push(d)
        }
      }

      const final = uniq.slice(0, limit)

      res.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      return res.send(final.map((d: any) => ({
        id: d.storeAppId || d.title,
        title: d.title,
        originalPrice: d.priceBase,
        finalPrice: d.priceFinal,
        discount: d.discountPct,
        url: d.url,
        coverUrl: d.coverUrl,
        store: d.store || 'steam',
      })))
    } catch (err: any) {
      console.error?.(err, 'feed error')
      res.status(500)
      return res.send({ error: err?.message || 'feed_error' })
    }
  })
}