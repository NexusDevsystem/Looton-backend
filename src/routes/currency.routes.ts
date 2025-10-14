// Adapted for Express shim - Fastify types removed
import { getBRLRate } from '../adapters/currency.service.js'

export default async function currencyRoutes(app: any) {
  app.get('/currency', async (request: any, reply: any) => {
    const base = (request.query as any)?.base || 'BRL'
    try {
      const rate = await getBRLRate(base)
      return reply.send({ base, rate })
    } catch (err) {
      return reply.code(500).send({ error: 'Unable to fetch rate' })
    }
  })
}
