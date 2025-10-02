import { User, UserDoc } from '../db/models/User.js'
import { Offer, OfferDoc } from '../db/models/Offer.js'
import { Types } from 'mongoose'

export interface DealResponse {
  gameId: string
  title: string
  steamGenres: Array<{ id: string; name: string }>
  coverUrl?: string
  store: string
  url: string
  priceFinalCents: number
  priceBaseCents: number
  discountPct: number
  isBest: boolean
  lastSeenAt: Date
  score?: number
}

/**
 * Busca ofertas com priorização baseada nas preferências do usuário
 */
export async function fetchDealsBoosted(userId: string, limit = 40): Promise<DealResponse[]> {
  try {
    const user = await User.findById(userId).lean()
    const prefs = user?.preferences ?? { preferredSteamGenreIds: [], minDiscount: 0, stores: [] }
    const prefIds = prefs.preferredSteamGenreIds
    const minDiscount = prefs.minDiscount ?? 0
    const storeFilter = prefs.stores?.length ? { storeId: { $in: prefs.stores.map(id => new Types.ObjectId(id)) } } : {}

    console.log(`Buscando deals boosted para usuário ${userId}:`, {
      preferredGenres: prefIds,
      minDiscount,
      stores: prefs.stores
    })

    const pipeline: any = [
      { 
        $match: { 
          isActive: true, 
          discountPct: { $gte: minDiscount }, 
          ...storeFilter 
        } 
      },
      { 
        $lookup: { 
          from: 'games', 
          localField: 'gameId', 
          foreignField: '_id', 
          as: 'game' 
        } 
      },
      { $unwind: '$game' },

      // Auxiliares para cálculo do score
      {
        $addFields: {
          _prefIds: prefIds,
          _gameGenreIds: { $ifNull: ['$game.steamGenres.id', []] },
          _interIds: { 
            $setIntersection: [
              { $ifNull: ['$game.steamGenres.id', []] }, 
              prefIds
            ] 
          },
          _hasMatch: { 
            $gt: [
              { $size: { $setIntersection: [{ $ifNull: ['$game.steamGenres.id', []] }, prefIds] } }, 
              0
            ] 
          },
          _overlapCount: { 
            $size: { 
              $setIntersection: [
                { $ifNull: ['$game.steamGenres.id', []] }, 
                prefIds
              ] 
            } 
          },

          _daysSince: { 
            $divide: [
              { $subtract: [new Date(), '$lastSeenAt'] }, 
              1000 * 60 * 60 * 24
            ] 
          },
          _recencyScore: {
            $subtract: [
              7, 
              { $min: [7, { $max: [0, { $round: ['$_daysSince', 0] }] }] }
            ]
          }
        }
      },

      // SCORE: gênero domina, desconto complementa, best price e recência refinam
      {
        $addFields: {
          score: {
            $add: [
              { $cond: ['$_hasMatch', 50, 0] },                // match de gênero pesa muito
              { $multiply: ['$_overlapCount', 10] },            // +10 por gênero que bate
              { $multiply: ['$discountPct', 0.6] },             // desconto ajuda
              { $cond: [{ $eq: ['$game.isBest', true] }, 10, 0] }, // bônus para "melhor preço"
              '$_recencyScore'                                  // recenticidade
            ]
          }
        }
      },

      { $sort: { score: -1, discountPct: -1, lastSeenAt: -1 } },
      { $limit: limit },

      // Payload final
      {
        $project: {
          _id: 0,
          gameId: '$game._id',
          title: '$game.title',
          steamGenres: { $ifNull: ['$game.steamGenres', []] },
          coverUrl: '$game.coverUrl',
          store: '$game.store',
          url: 1,
          // Convertendo de reais para centavos (multiplicando por 100)
          priceFinalCents: { $round: [{ $multiply: ['$priceFinal', 100] }, 0] },
          priceBaseCents: { $round: [{ $multiply: ['$priceBase', 100] }, 0] },
          discountPct: '$discountPct',
          isBest: '$game.isBest',
          lastSeenAt: '$lastSeenAt',
          score: 1
        }
      }
    ]

    const results = await Offer.aggregate(pipeline).exec() as any[]
    
    console.log(`Encontradas ${results.length} ofertas boosted para usuário ${userId}`)
    
    // Log dos primeiros resultados para debug
    if (results.length > 0) {
      console.log('Top 3 ofertas boosted:', results.slice(0, 3).map(r => ({
        title: r.title,
        score: r.score,
        discount: r.discountPct,
        genres: r.steamGenres?.map((g: any) => g.name)
      })))
    }

    return results
  } catch (error) {
    console.error('Erro ao buscar deals boosted:', error)
    throw error
  }
}

/**
 * Busca ofertas sem personalização (ordenação padrão)
 */
export async function fetchDealsDefault(limit = 40): Promise<DealResponse[]> {
  try {
    const pipeline: any = [
      { $match: { isActive: true } },
      { 
        $lookup: { 
          from: 'games', 
          localField: 'gameId', 
          foreignField: '_id', 
          as: 'game' 
        } 
      },
      { $unwind: '$game' },
      { $sort: { discountPct: -1, lastSeenAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          gameId: '$game._id',
          title: '$game.title',
          steamGenres: { $ifNull: ['$game.steamGenres', []] },
          coverUrl: '$game.coverUrl',
          store: '$game.store',
          url: 1,
          // Convertendo de reais para centavos (multiplicando por 100)
          priceFinalCents: { $round: [{ $multiply: ['$priceFinal', 100] }, 0] },
          priceBaseCents: { $round: [{ $multiply: ['$priceBase', 100] }, 0] },
          discountPct: '$discountPct',
          isBest: '$game.isBest',
          lastSeenAt: '$lastSeenAt'
        }
      }
    ]

    const results = await Offer.aggregate(pipeline).exec() as any[]
    
    console.log(`Encontradas ${results.length} ofertas padrão`)
    
    return results
  } catch (error) {
    console.error('Erro ao buscar deals padrão:', error)
    throw error
  }
}