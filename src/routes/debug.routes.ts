import { FastifyInstance } from 'fastify'
import { upsertOffersAndNotify } from '../services/offers.service.js'
import { OfferDTO } from '../adapters/types.js'

// Simple in-memory store for debug push tokens. Not for production.
const debugPushTokens = new Map<string, string>()

export default async function debugRoutes(app: FastifyInstance) {
  app.post('/push/register', async (request, reply) => {
    const body = request.body as { userId?: string; pushToken: string }
    if (!body?.pushToken) return reply.status(400).send({ message: 'pushToken required' })
    const key = body.userId || 'anonymous'
    debugPushTokens.set(key, body.pushToken)
    return reply.send({ ok: true })
  })

  // Trigger an offer ingestion for testing notifications.
  app.post('/debug/trigger', async (request, reply) => {
    const body = request.body as any

    if (!body || !body.store || typeof body.priceFinal !== 'number')
      return reply.status(400).send({ message: 'store and priceFinal required' })

    const dto: OfferDTO = {
      store: body.store,
      storeAppId: body.storeAppId ? String(body.storeAppId) : '0',
      title: body.title || 'DEBUG GAME',
      url: body.url || '',
      priceBase: body.priceBase ?? body.priceFinal,
      priceFinal: body.priceFinal,
      discountPct: body.discountPct ?? Math.round(((body.priceBase ?? body.priceFinal) - body.priceFinal) / (body.priceBase ?? body.priceFinal) * 100),
      isActive: true,
      coverUrl: body.coverUrl || ''
    }

    // If a pushToken is provided, register it under the anonymous key so notification send path can pick it up.
    if (body.pushToken) debugPushTokens.set(body.userId || 'anonymous', body.pushToken)

    try {
      await upsertOffersAndNotify([dto])
      return reply.send({ ok: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'failed to process' })
    }
  })
}

export { debugPushTokens }

