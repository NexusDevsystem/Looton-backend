/**
 * IsThereAnyDeal API Adapter
 * Docs: https://docs.isthereanydeal.com/
 */

import { OfferDTO } from './types.js'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'

// Configuração da API
const ITAD_API_KEY = 'db77f13ee26c9a0a229c6943ae9cfcb62030133e'
const ITAD_CLIENT_ID = '3ec7186d43a39677'
const ITAD_CLIENT_SECRET = '076d6288b95c6b89b2ea03494d8c7ac412a1e1f1'

// Cache de 5 minutos
const dealsCache = new MemoryCache<string, OfferDTO[]>(ttlSecondsToMs(300))

// Mapeamento de lojas ITAD para nosso sistema
const STORE_MAPPING: Record<string, 'steam' | 'epic' | 'ubisoft'> = {
  'steam': 'steam',
  'epicgames': 'epic',
  'uplay': 'ubisoft'
}

// IDs das lojas no ITAD
const ALLOWED_STORES = ['steam', 'epicgames', 'uplay']

interface ITADDeal {
  id: string
  title: string
  price: {
    amount: number
    currency: string
  }
  regular: {
    amount: number
    currency: string
  }
  cut: number // Desconto em porcentagem
  url: string
  shop: {
    id: string
    name: string
  }
  drm?: string[]
}

/**
 * Busca deals ativos das lojas permitidas
 */
async function fetchDeals(region: string = 'br', limit: number = 100): Promise<OfferDTO[]> {
  const cacheKey = `deals:${region}:${limit}`
  
  const cached = dealsCache.get(cacheKey)
  if (cached) {
    console.log(`✅ Usando ${cached.length} deals do cache ITAD`)
    return cached
  }

  try {
    console.log('🔍 Buscando deals do IsThereAnyDeal...')
    
    // Endpoint: /v2/deals/list
    const url = new URL('https://api.isthereanydeal.com/v02/search/search/')
    url.searchParams.append('key', ITAD_API_KEY)
    url.searchParams.append('region', region)
    url.searchParams.append('country', region.toUpperCase())
    url.searchParams.append('limit', String(limit))
    url.searchParams.append('sort', 'price:asc') // Menor preço primeiro
    
    // Filtrar apenas lojas permitidas
    url.searchParams.append('shops', ALLOWED_STORES.join(','))

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      console.error(`❌ ITAD API erro: ${response.status}`)
      return []
    }

    const data = await response.json()
    const deals = data.data?.list || []
    
    console.log(`📊 ITAD retornou ${deals.length} deals`)

    const offers: OfferDTO[] = []

    for (const deal of deals) {
      // Verificar se a loja é permitida
      const storeId = deal.shop?.id?.toLowerCase()
      if (!storeId || !ALLOWED_STORES.includes(storeId)) {
        continue
      }

      const mappedStore = STORE_MAPPING[storeId]
      if (!mappedStore) continue

      // Converter preços (ITAD retorna em número decimal)
      const priceBase = deal.regular?.amount || 0
      const priceFinal = deal.price?.amount || 0
      const discountPct = deal.cut || 0

      // Só adicionar se tiver desconto
      if (discountPct <= 0) continue

      const offer: OfferDTO = {
        store: mappedStore,
        storeAppId: deal.id || String(Math.random()),
        title: deal.title || 'Sem título',
        url: deal.url || '',
        priceBase: priceBase,
        priceFinal: priceFinal,
        priceBaseCents: Math.round(priceBase * 100),
        priceFinalCents: Math.round(priceFinal * 100),
        discountPct: Math.round(discountPct),
        currency: deal.price?.currency || 'BRL',
        isActive: true,
        coverUrl: '', // ITAD não fornece imagem diretamente
        genres: [],
        tags: []
      }

      offers.push(offer)
    }

    console.log(`✅ ${offers.length} deals processados do ITAD`)

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
    return fetchDeals('br', 100)
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
