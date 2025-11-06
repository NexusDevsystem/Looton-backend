/**
 * IsThereAnyDeal API Adapter
 * Docs: https://isthereanydeal.com/api/v2/
 */

import { OfferDTO } from './types.js'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'

// Configuração da API
const ITAD_API_KEY = 'db77f13ee26c9a0a229c6943ae9cfcb62030133e'

// Cache de 5 minutos
const dealsCache = new MemoryCache<string, OfferDTO[]>(ttlSecondsToMs(300))

// Mapeamento de Shop IDs ITAD → nosso sistema
// Ref: GET /service/shops/v1 para lista completa
const SHOP_ID_MAPPING: Record<number, 'steam' | 'epic' | 'ubisoft'> = {
  61: 'steam',      // Steam
  35: 'epic',       // Epic Games Store
  25: 'ubisoft'     // Ubisoft Connect
}

interface ITADDealsResponse {
  nextOffset?: number
  hasMore?: boolean
  list: Array<{
    id: string
    slug: string
    title: string
    type: string
    mature: boolean
    assets?: {
      boxart?: string
      banner145?: string
      banner300?: string
      banner400?: string
      banner600?: string
    }
    deal: {
      shop: { id: number; name: string }
      price: { amount: number; currency: string }
      regular: { amount: number; currency: string }
      cut: number
      url: string
    }
  }>
}

interface ITADLookupResponse {
  [gameId: string]: string[] // { "game-uuid": ["app/123", "sub/456"] }
}

/**
 * Converte IDs do ITAD em IDs reais das lojas (Steam AppID, etc)
 * Endpoint: POST /lookup/shop/{shopId}/id/v1
 */
async function lookupShopIds(shopId: number, gameIds: string[]): Promise<Record<string, string[]>> {
  if (gameIds.length === 0) return {}

  try {
    const url = `https://api.isthereanydeal.com/lookup/shop/${shopId}/id/v1`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gameIds)
    })

    if (!response.ok) {
      console.error(`❌ ITAD Lookup erro: ${response.status}`)
      return {}
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Erro no lookup ITAD:', error)
    return {}
  }
}

/**
 * Extrai Steam AppID de um ID da loja Steam
 * Exemplo: "app/730" -> "730"
 */
function extractSteamAppId(shopId: string): string | null {
  const match = shopId.match(/^app\/(\d+)$/)
  return match ? match[1] : null
}

/**
 * Busca deals ativos usando /deals/v2
 * Ref: https://isthereanydeal.com/api/v2/#/Deals%20List/get_deals_v2
 */
async function fetchDeals(country: string = 'BR', limit: number = 100): Promise<OfferDTO[]> {
  const cacheKey = `deals:${country}:${limit}`
  
  const cached = dealsCache.get(cacheKey)
  if (cached) {
    console.log(`✅ Usando ${cached.length} deals do cache ITAD`)
    return cached
  }

  try {
    console.log('🔍 Buscando deals do IsThereAnyDeal /deals/v2...')
    
    // Endpoint correto: GET /deals/v2
    const url = new URL('https://api.isthereanydeal.com/deals/v2')
    url.searchParams.append('key', ITAD_API_KEY)
    url.searchParams.append('country', country)
    url.searchParams.append('limit', String(limit))
    url.searchParams.append('offset', '0')
    url.searchParams.append('sort', '-cut') // Maior desconto primeiro
    
    // Filtrar APENAS Epic (35) e Ubisoft (25) - Steam vem da API Steam direta
    const shopIds = [35, 25] // Epic Games Store, Ubisoft Connect
    url.searchParams.append('shops', shopIds.join(','))

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      console.error(`❌ ITAD API erro: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error(`❌ Response body: ${text}`)
      return []
    }

    const data: ITADDealsResponse = await response.json()
    
    if (!data || !Array.isArray(data.list)) {
      console.error('❌ ITAD API: resposta inválida', data)
      return []
    }
    
    console.log(`📊 ITAD retornou ${data.list.length} deals`)

    // Separar games por loja para fazer lookup em batch
    const epicGames: string[] = []
    const ubisoftGames: string[] = []
    const gameMap = new Map<string, typeof data.list[0]>() // gameId -> item

    for (const item of data.list) {
      if (!item.deal) continue

      const shopId = item.deal.shop.id
      const store = SHOP_ID_MAPPING[shopId]
      
      if (!store) {
        console.log(`⚠️ Shop ID ${shopId} (${item.deal.shop.name}) não mapeada, ignorando...`)
        continue
      }

      gameMap.set(item.id, item)

      if (shopId === 35) epicGames.push(item.id)    // Epic
      if (shopId === 25) ubisoftGames.push(item.id) // Ubisoft
    }

    console.log(`🔍 Fazendo lookup: ${epicGames.length} jogos Epic, ${ubisoftGames.length} jogos Ubisoft`)

    // Fazer lookup dos IDs reais nas lojas
    const [epicLookup, ubisoftLookup] = await Promise.all([
      lookupShopIds(35, epicGames),
      lookupShopIds(25, ubisoftGames)
    ])

    console.log(`✅ Lookup completo: ${Object.keys(epicLookup).length} Epic, ${Object.keys(ubisoftLookup).length} Ubisoft`)

    const offers: OfferDTO[] = []

    // Processar jogos Epic
    for (const [gameId, shopIds] of Object.entries(epicLookup)) {
      const item = gameMap.get(gameId)
      if (!item || shopIds.length === 0) continue

      const epicId = shopIds[0] // Epic usa IDs diretos
      const priceBase = item.deal.regular.amount
      const priceFinal = item.deal.price.amount
      const discountPct = item.deal.cut
      const coverUrl = item.assets?.banner300 || item.assets?.boxart || ''

      offers.push({
        store: 'epic',
        storeAppId: epicId,
        title: item.title,
        url: `https://store.epicgames.com/p/${item.slug}`,
        priceBase: priceBase,
        priceFinal: priceFinal,
        priceBaseCents: Math.round(priceBase * 100),
        priceFinalCents: Math.round(priceFinal * 100),
        discountPct: Math.round(discountPct),
        currency: item.deal.price.currency,
        isActive: true,
        coverUrl: coverUrl,
        genres: [],
        tags: []
      })
    }

    // Processar jogos Ubisoft
    for (const [gameId, shopIds] of Object.entries(ubisoftLookup)) {
      const item = gameMap.get(gameId)
      if (!item || shopIds.length === 0) continue

      const ubisoftId = shopIds[0]
      const priceBase = item.deal.regular.amount
      const priceFinal = item.deal.price.amount
      const discountPct = item.deal.cut
      const coverUrl = item.assets?.banner300 || item.assets?.boxart || ''

      offers.push({
        store: 'ubisoft',
        storeAppId: ubisoftId,
        title: item.title,
        url: item.deal.url, // Ubisoft usa URL direta do ITAD
        priceBase: priceBase,
        priceFinal: priceFinal,
        priceBaseCents: Math.round(priceBase * 100),
        priceFinalCents: Math.round(priceFinal * 100),
        discountPct: Math.round(discountPct),
        currency: item.deal.price.currency,
        isActive: true,
        coverUrl: coverUrl,
        genres: [],
        tags: []
      })
    }

    console.log(`✅ ${offers.length} deals processados do ITAD (${offers.filter(o => o.store === 'epic').length} Epic, ${offers.filter(o => o.store === 'ubisoft').length} Ubisoft)`)

    // Cachear resultado
    dealsCache.set(cacheKey, offers)

    return offers
  } catch (error) {
    console.error('❌ Erro ao buscar deals do ITAD:', error)
    return []
  }
}

/**
 * Adapter compatível com o sistema atual
 */
export const itadAdapter = {
  /**
   * Busca trending deals (mesma interface do steamAdapter)
   */
  async fetchTrending(): Promise<OfferDTO[]> {
    return fetchDeals('BR', 100)
  },

  /**
   * Busca por termo (não implementado no ITAD por enquanto)
   */
  async search(query: string): Promise<OfferDTO[]> {
    console.log(`🔍 Busca ITAD: "${query}" (não implementado)`)
    return []
  },

  /**
   * Busca por IDs específicos (não implementado)
   */
  async fetchByIds(ids: string[]): Promise<OfferDTO[]> {
    console.log(`🔍 Busca ITAD por IDs: ${ids.length} (não implementado)`)
    return []
  }
}
