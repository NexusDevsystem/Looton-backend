import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getOffersByGame, getHistory } from '../services/offers.service.js'
import { searchGames, searchGamesInStores } from '../services/games.service.js'

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

  // GET /games/search - Pesquisa avançada de jogos
  app.get('/games/search', async (req: any, reply: any) => {
    const schema = z.object({ q: z.string().optional(), limit: z.coerce.number().min(1).max(100).optional() })
    const { q, limit } = schema.parse(req.query)

    const minChars = 2
    if (!q || q.length < minChars) {
      return reply.send({ items: [] })
    }

    try {
      // Text search on games collection using $text
      const lim = limit || 24
      const Game = (await import('../db/models/Game.js')).Game
      const Offer = (await import('../db/models/Offer.js')).Offer

      // Find games matching text, sort by text score
      let games = await Game.find({ $text: { $search: q }, deletedAt: { $exists: false } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(lim)
        .lean()

      // If no games in DB, try fetching from adapters (e.g. Steam) via existing service
      // This will upsert results into DB so a subsequent DB query can return them.
      if (!games || games.length === 0) {
        try {
          // call adapters/search service (this reuses existing adapter code; we don't modify adapters here)
          await searchGamesInStores(q, ['steam'])
          // re-query DB
          games = await Game.find({ $text: { $search: q }, deletedAt: { $exists: false } }, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(lim)
            .lean()
        } catch (err) {
          console.error('Erro ao buscar em stores externas dentro /games/search:', err)
        }
      }

      // For each game, find best active offer (lowest priceFinal)
      const Store = (await import('../db/models/Store.js')).Store
      const items = await Promise.all(games.map(async (g: any) => {
        const best = await Offer.findOne({ gameId: g._id, isActive: true }).sort({ priceFinal: 1 }).lean()
        let bestOffer = null
        if (best) {
          const storeDoc = await Store.findById(best.storeId).lean()
          bestOffer = {
            store: storeDoc?.name || 'store',
            priceFinalCents: Math.round((best.priceFinal || 0) * 100),
            discountPct: best.discountPct || 0,
            url: best.url || ''
          }
        }

        return {
          id: String(g._id),
          title: g.title,
          coverUrl: g.coverUrl || null,
          genres: g.genres || [],
          tags: g.tags || [],
          bestOffer
        }
      }))

      return reply.send({ items })
    } catch (err) {
      console.error('Erro na rota /games/search:', err)
      return reply.status(500).send({ error: 'Erro interno' })
    }
  })
}
