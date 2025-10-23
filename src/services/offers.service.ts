import { OfferDTO } from '../adapters/types.js'
import { redis, deleteByPattern } from '../lib/redis.js'
import { slugify } from '../utils/slugify.js'
import { checkAndNotify } from './alerts.service.js'
import { checkFavoritesAndNotify } from './favorites.service.js'

export async function upsertOffersAndNotify(list: OfferDTO[]) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria caches em memória ou outro sistema
  console.log(`Upserting ${list.length} offers (without database)`)
  
  // Simular o processamento das ofertas
  for (const dto of list) {
    console.log(`Processing offer: ${dto.title} - ${dto.priceFinal}`)
    
    // Simular notificações
    // Em um sistema real, você verificaria regras de alertas e favoritos
    // usando um sistema de cache ou outro mecanismo persistente
  }
  
  await deleteByPattern('cache:deals:*')
}

export async function getTopDeals(minDiscount = 0, limit = 20) {
  const key = `cache:deals:${minDiscount}:${limit}`
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached)

  // Simular dados de exemplo
  const mockDeals = [
    {
      _id: 'offer_1',
      url: 'https://example.com/game1',
      priceBase: 100,
      priceFinal: 50,
      discountPct: 50,
      game: {
        title: 'Jogo Exemplo 1',
        coverUrl: 'https://example.com/cover1.jpg',
        genres: ['Ação', 'Aventura']
      },
      store: {
        name: 'Exemplo Store'
      }
    }
  ]

  await redis.setex(key, 60, JSON.stringify(mockDeals))
  return mockDeals
}

export async function getOffersByGame(gameId: string) {
  // Simular dados de exemplo
  const mockOffers = [
    {
      _id: `offer_${gameId}_1`,
      url: `https://example.com/game/${gameId}`,
      priceBase: 60,
      priceFinal: 30,
      discountPct: 50,
      store: {
        name: 'Exemplo Store'
      }
    }
  ]
  return mockOffers
}

export async function getHistory(gameId: string, limit = 60) {
  // Simular histórico de preços
  const mockHistory = [
    {
      _id: `history_${gameId}_1`,
      priceFinal: 60,
      discountPct: 0,
      seenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 dias atrás
    },
    {
      _id: `history_${gameId}_2`,
      priceFinal: 30,
      discountPct: 50,
      seenAt: new Date() // Hoje
    }
  ]
  return mockHistory
}

export interface DealsFilters {
  genres?: string[]
  tags?: string[]
  stores?: string[]
  minDiscount?: number
  maxPrice?: number
  page?: number
  limit?: number
}

export async function getFilteredDeals(filters: DealsFilters) {
  const { 
    genres, 
    tags, 
    stores, 
    minDiscount = 0, 
    maxPrice, 
    page = 1, 
    limit = 24 
  } = filters
  
  const skip = (page - 1) * limit

  // Simular dados de exemplo
  const mockDeals = [
    {
      _id: 'offer_1',
      url: 'https://example.com/game1',
      priceBaseCents: 10000,
      priceFinalCents: 5000,
      discountPct: 50,
      game: {
        _id: 'game_1',
        title: 'Jogo Exemplo 1',
        coverUrl: 'https://example.com/cover1.jpg',
        genres: ['Ação', 'Aventura'],
        tags: ['FPS', 'Multiplayer']
      },
      store: {
        name: 'Exemplo Store'
      }
    }
  ]

  return {
    deals: mockDeals,
    total: mockDeals.length,
    page,
    limit,
    totalPages: Math.ceil(mockDeals.length / limit)
  }
}