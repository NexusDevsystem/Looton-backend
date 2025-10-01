import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getTopDeals, getFilteredDeals } from '../services/offers.service.js'

export default async function dealsRoutes(app: FastifyInstance) {
  app.get('/deals', async (req: any, reply: any) => {
    const schema = z.object({
      minDiscount: z.coerce.number().min(0).max(100).optional(),
      limit: z.coerce.number().min(1).max(1000).optional() // Aumentado para 1000
    })
    const { minDiscount, limit } = schema.parse(req.query)
    const deals = await getTopDeals(minDiscount ?? 0, limit ?? 500) // Padrão 500 ofertas
    return reply.send(deals)
  })

  // GET /deals/filter - Filtragem avançada de ofertas
  app.get('/deals/filter', async (req: any, reply: any) => {
    const schema = z.object({
      genres: z.string().optional().transform(val => val ? val.split(',').map(g => g.trim()) : undefined),
      tags: z.string().optional().transform(val => val ? val.split(',').map(t => t.trim()) : undefined),
      stores: z.string().optional().transform(val => val ? val.split(',').map(s => s.trim()) : undefined),
      minDiscount: z.coerce.number().min(0).max(100).optional(),
      maxPrice: z.coerce.number().min(0).optional(), // Em centavos
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(100).optional()
    })

    const filters = schema.parse(req.query)
    const deals = await getFilteredDeals(filters)
    return reply.send(deals)
  })
}
