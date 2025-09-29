import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getOffersByGame, getHistory } from '../services/offers.service.js'

export default async function gamesRoutes(app: FastifyInstance) {
  app.get('/games/:id/offers', async (req: any, reply: any) => {
    const schema = z.object({ id: z.string().length(24) })
    const { id } = schema.parse(req.params)
    const offers = await getOffersByGame(id)
    return reply.send(offers)
  })

  app.get('/games/:id/history', async (req: any, reply: any) => {
    const schema = z.object({ id: z.string().length(24) })
    const { id } = schema.parse(req.params)
    const hist = await getHistory(id)
    return reply.send(hist)
  })
}
