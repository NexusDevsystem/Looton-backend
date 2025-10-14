import { FastifyInstance } from 'fastify'
import { getDailySteamDeals, clearDailyDealsCache } from '../services/daily-steam-deals.service.js'
import { getPermanentDeals, clearPermanentDealsCache } from '../services/permanent-deals-cache.service.js'

export default async function feedRoutes(app: FastifyInstance) {
  app.get('/feed', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
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

      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      return final.map((d) => ({
        id: d.storeAppId || d.title,
        title: d.title,
        originalPrice: d.priceBase,
        finalPrice: d.priceFinal,
        discount: d.discountPct,
        url: d.url,
        coverUrl: d.coverUrl,
        store: d.store || 'steam',
      }))
    } catch (err: any) {
      app.log?.error?.(err, 'feed error')
      reply.code(500)
      return { error: err?.message || 'feed_error' }
    }
  })
}