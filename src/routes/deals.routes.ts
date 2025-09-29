import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getTopDeals } from '../services/offers.service.js'

export default async function dealsRoutes(app: FastifyInstance) {
  app.get('/deals', async (req: any, reply: any) => {
    const schema = z.object({
      minDiscount: z.coerce.number().min(0).max(100).optional(),
      limit: z.coerce.number().min(1).max(100).optional()
    })
    const { minDiscount, limit } = schema.parse(req.query)
    const deals = await getTopDeals(minDiscount ?? 0, limit ?? 20)
    return reply.send(deals)
  })
}
