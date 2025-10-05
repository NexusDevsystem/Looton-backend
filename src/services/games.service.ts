import { OfferDTO, StoreAdapter } from '../adapters/types.js'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { epicAdapter } from '../adapters/epic.adapter.js'

import { upsertOffersAndNotify } from './offers.service.js'
import { redis } from '../lib/redis.js'
import { Game } from '../db/models/Game.js'
import { Store } from '../db/models/Store.js'
import { Offer } from '../db/models/Offer.js'

const adapters: Record<string, StoreAdapter> = {
  steam: steamAdapter,
  epic: epicAdapter
}

export async function searchGamesInStores(query: string, stores?: string[]) {
  const list = stores?.length ? stores : Object.keys(adapters)
  const cacheKey = `cache:search:${query}:${list.sort().join(',')}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const results: OfferDTO[] = []
  for (const s of list) {
    const adapter = adapters[s]
    if (!adapter) continue
    const items = await adapter.search(query)
    results.push(...items)
  }
  // persist offers and games for search results
  await upsertOffersAndNotify(results)
  await redis.setex(cacheKey, 30, JSON.stringify(results))
  return results
}

export interface SearchFilters {
  q?: string
  genres?: string[]
  tags?: string[]
  stores?: string[]
  page?: number
  limit?: number
}

export async function searchGames(filters: SearchFilters) {
  const { q, genres, tags, stores, page = 1, limit = 24 } = filters
  const skip = (page - 1) * limit

  // Build MongoDB query
  let gameQuery: any = {}
  
  // Text search
  if (q) {
    gameQuery.$text = { $search: q }
  }
  
  // Genre filter
  if (genres?.length) {
    gameQuery.genres = { $in: genres }
  }
  
  // Tag filter
  if (tags?.length) {
    gameQuery.tags = { $in: tags }
  }
  
  // Store filter - we need to join with stores
  let storeIds: any[] = []
  if (stores?.length) {
    const storeDocuments = await Store.find({ name: { $in: stores } })
    storeIds = storeDocuments.map(s => s._id)
    if (storeIds.length === 0) {
      return { games: [], total: 0, page, limit }
    }
    gameQuery.storeId = { $in: storeIds }
  }

  const [games, total] = await Promise.all([
    Game.find(gameQuery)
      .populate('storeId')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Game.countDocuments(gameQuery)
  ])

  // Get best active offer for each game
  const gamesWithOffers = await Promise.all(
    games.map(async (game) => {
      const bestOffer = await Offer.findOne({
        gameId: game._id,
        isActive: true
      }).sort({ discountPercent: -1, priceFinalCents: 1 })

      return {
        ...game.toObject(),
        bestOffer: bestOffer?.toObject()
      }
    })
  )

  return {
    games: gamesWithOffers,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}
