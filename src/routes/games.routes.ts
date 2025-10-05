import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getOffersByGame, getHistory } from '../services/offers.service.js'
import { matchesGenres, toCanonicalGenre } from '../utils/genres.js'
import { pickImageUrls } from '../utils/imageUtils.js'

type GameItem = {
  id: string;
  title: string;
  coverUrl?: string;
  genres: string[];
  tags: string[];
  priceFinalCents: number;
  discountPct?: number;
  store: string;
  url: string;
};

function sortGames(items: GameItem[], sortBy: string) {
  switch (sortBy) {
    case 'best_price':
      // menor preço primeiro; empate: maior desconto
      return items.sort((a, b) =>
        (a.priceFinalCents - b.priceFinalCents) ||
        ((b.discountPct ?? 0) - (a.discountPct ?? 0))
      );
    case 'biggest_discount':
      // maior %OFF primeiro; empate: menor preço
      return items.sort((a, b) =>
        ((b.discountPct ?? 0) - (a.discountPct ?? 0)) ||
        (a.priceFinalCents - b.priceFinalCents)
      );
    default:
      return items;
  }
}

export default async function gamesRoutes(app: FastifyInstance) {
  // GET /games - Feed principal com filtros e ordenação
  app.get('/games', async (req: any, reply: any) => {
    const schema = z.object({
      genres: z.string().optional(),
      sortBy: z.enum(['best_price', 'biggest_discount']).default('best_price'),
      limit: z.coerce.number().min(1).max(100).default(20),
      cursor: z.coerce.number().min(0).default(0)
    })
    
    const { genres, sortBy, limit, cursor } = schema.parse(req.query)

    try {
      const Game = (await import('../db/models/Game.js')).Game
      const Offer = (await import('../db/models/Offer.js')).Offer
      const Store = (await import('../db/models/Store.js')).Store

      // 1) Buscar todos os jogos com ofertas ativas
      const gamesWithOffers = await Game.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        {
          $lookup: {
            from: 'offers',
            localField: '_id',
            foreignField: 'gameId',
            as: 'offers'
          }
        },
        {
          $match: {
            'offers': { $elemMatch: { isActive: true } }
          }
        },
        {
          $addFields: {
            bestOffer: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: { $filter: { input: '$offers', cond: { $eq: ['$$this.isActive', true] } } },
                    sortBy: { priceFinal: 1 }
                  }
                },
                0
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'bestOffer.storeId',
            foreignField: '_id',
            as: 'storeInfo'
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            coverUrl: 1,
            genres: 1,
            tags: 1,
            bestOffer: {
              priceFinal: '$bestOffer.priceFinal',
              discountPct: '$bestOffer.discountPct',
              url: '$bestOffer.url',
              store: { $arrayElemAt: ['$storeInfo.name', 0] }
            }
          }
        }
      ])

      // 2) Converter para formato GameItem
      let items: GameItem[] = gamesWithOffers.map((g: any) => {
        const imageUrls = pickImageUrls({ header_image: g.coverUrl })
        return {
          id: String(g._id),
          title: g.title,
          coverUrl: g.coverUrl || null,
          imageUrls,
          image: imageUrls[0], // compat com UI atual
          genres: g.genres || [],
          tags: g.tags || [],
          priceFinalCents: Math.round((g.bestOffer?.priceFinal || 0) * 100),
          discountPct: g.bestOffer?.discountPct || 0,
          store: g.bestOffer?.store || 'store',
          url: g.bestOffer?.url || ''
        }
      })

      // 3) Filtro por gêneros (CSV vindo da UI)
      if (genres) {
        const wanted = genres
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(toCanonicalGenre)

        if (wanted.length > 0) {
          items = items.filter(item => 
            item.genres?.length && matchesGenres(item.genres, wanted)
          )
        }
      }

      // 4) Ordenação (melhor preço por padrão)
      items = sortGames(items, sortBy)

      // 5) Paginação por cursor
      const start = cursor
      const end = start + limit
      const slice = items.slice(start, end)
      const nextCursor = end < items.length ? end : null

      return reply
        .header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
        .send({ items: slice, nextCursor })
    } catch (err) {
      console.error('Erro na rota /games:', err)
      return reply.status(500).send({ error: 'Erro interno' })
    }
  })

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
      // Buscar diretamente na Steam API (sem banco de dados)
      const lim = limit || 24
      const { steamAdapter } = await import('../adapters/steam.adapter.js')
      
      console.log(`🔍 Buscando "${q}" diretamente na Steam API...`)
      const offers = await steamAdapter.search(q)
      
      // Converter OfferDTO[] para o formato esperado pelo frontend
      const items = offers.slice(0, lim).map((offer) => {
        const imageUrls = pickImageUrls({ header_image: offer.coverUrl })
        return {
          id: offer.storeAppId,
          title: offer.title,
          coverUrl: offer.coverUrl || null,
          imageUrls,
          image: imageUrls[0], // compat com UI atual
          genres: offer.genres || [],
          tags: offer.tags || [],
          bestOffer: {
            store: offer.store,
            priceFinalCents: offer.priceFinalCents,
            discountPct: offer.discountPct,
            url: offer.url
          }
        }
      })

      console.log(`✅ Retornando ${items.length} resultados da Steam`)
      return reply.send({ items })
    } catch (err) {
      console.error('Erro na rota /games/search:', err)
      return reply.status(500).send({ error: 'Erro interno' })
    }
  })
}
