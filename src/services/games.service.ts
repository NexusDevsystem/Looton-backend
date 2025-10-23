import { OfferDTO, StoreAdapter } from '../adapters/types.js'
import { steamAdapter } from '../adapters/steam.adapter.js'

import { upsertOffersAndNotify } from './offers.service.js'
import { redis } from '../lib/redis.js'

const adapters: Record<string, StoreAdapter> = {
  steam: steamAdapter
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

  // Simular busca sem banco de dados
  // Em um sistema real, você usaria um cache ou outro mecanismo persistente
  
  // Simular resultados
  const mockResults = [
    {
      _id: 'game_1',
      title: 'Jogo Exemplo 1',
      coverUrl: 'https://example.com/cover1.jpg',
      genres: ['Ação', 'Aventura'],
      tags: ['FPS', 'Multiplayer'],
      storeId: { name: 'Exemplo Store' },
      bestOffer: {
        priceFinalCents: 5000,
        discountPercent: 50
      }
    }
  ]

  // Simular paginação
  const paginatedResults = mockResults.slice(skip, skip + limit)
  
  return {
    games: paginatedResults,
    total: mockResults.length,
    page,
    limit,
    totalPages: Math.ceil(mockResults.length / limit)
  }
}