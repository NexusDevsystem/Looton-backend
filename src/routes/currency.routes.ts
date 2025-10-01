import { FastifyInstance } from 'fastify'
import { getBRLRate } from '../adapters/currency.service.js'

export default async function currencyRoutes(app: FastifyInstance) {
  app.get('/currency', async (request, reply) => {
    const base = (request.query as any)?.base || 'BRL'
    try {
      const rate = await getBRLRate(base)
      return reply.send({ base, rate })
    } catch (err) {
      return reply.code(500).send({ error: 'Unable to fetch rate' })
    }
  })
}
