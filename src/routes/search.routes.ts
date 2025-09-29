import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { searchGames } from '../services/games.service.js'

export default async function searchRoutes(app: FastifyInstance) {
  app.get('/search', async (req: any, reply: any) => {
    const schema = z.object({ q: z.string().min(1), stores: z.string().optional() })
    const { q, stores } = schema.parse(req.query)
    const storeList = stores ? stores.split(',').map((s: string) => s.trim()) : undefined
    const results = await searchGames(q, storeList as any)
    return reply.send(results)
  })
}
