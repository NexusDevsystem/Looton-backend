import { OfferDTO, StoreAdapter } from './types.js'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js'

// Cache curto por região/idioma (5 minutos)
const specialsCache = new MemoryCache<string, OfferDTO[]>(ttlSecondsToMs(300))

function key(cc: string, l: string) {
  return `${cc}|${l}`.toLowerCase()
}

export const steamAdapter: StoreAdapter = {
  async fetchTrending(): Promise<OfferDTO[]> {
    try {
      // Para v1 simples: fixar BR/pt-BR. Em produção, usar cc/l do usuário.
      const cc = 'BR'
      const l = 'pt-BR'
      const cacheKey = key(cc, l)

      const cached = specialsCache.get(cacheKey)
      if (cached) return cached

      console.log('🎮 Buscando ofertas (specials) da Steam...')
      const url = `https://store.steampowered.com/api/featuredcategories?cc=${cc}&l=${l}`
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Referer': 'https://store.steampowered.com/'
        }
      }, 15000) // 15 segundos de timeout
      if (!res.ok) {
        console.error(`Erro na requisição Steam: ${res.status} ${res.statusText}`)
        return []
      }
      const json = await res.json()

      const items: any[] = json?.specials?.items ?? []
      const offers: OfferDTO[] = []

      for (const it of items) {
        // specials fornece: id, name, original_price, final_price, discount_percent, header_image
        if (!it?.id || !it?.name) continue
        const initial = typeof it.original_price === 'number' ? it.original_price : 0
        const final = typeof it.final_price === 'number' ? it.final_price : 0
        const discount = typeof it.discount_percent === 'number' ? it.discount_percent : 0

        // Filtrar apenas itens com desconto (> 0) e preço válido
        if (!(discount > 0 && initial > 0 && final >= 0)) continue

        const offer: OfferDTO = {
          store: 'steam',
          storeAppId: String(it.id),
          title: it.name,
          url: `https://store.steampowered.com/app/${it.id}/`,
          priceBase: Math.round(initial) / 100,
          priceFinal: Math.round(final) / 100,
          priceBaseCents: Math.round(initial),
          priceFinalCents: Math.round(final),
          discountPct: Math.max(0, Math.min(100, Math.round(discount))),
          currency: 'BRL',
          isActive: true,
          coverUrl: it.header_image || '',
          genres: [],
          tags: []
        }
        offers.push(offer)
      }

      // NOTA: Removendo ordenação fixa aqui para permitir ordenação por qualidade mais tarde
      // A ordenação por qualidade será feita nos serviços superiores

      // Cache curto
      specialsCache.set(cacheKey, offers)
      return offers
      
    } catch (error) {
      console.error('❌ Erro no Steam adapter:', error)
      return []
    }
  },

  async search(query: string): Promise<OfferDTO[]> {
    try {
      console.log(`🔍 Pesquisando Steam por: "${query}"`)
      // Mantém a pesquisa simples por enquanto; poderia usar appdetails
      const encodedQuery = encodeURIComponent(query)
      const response = await fetch('https://store.steampowered.com/api/storesearch/?term=' + encodedQuery + '&cc=BR&l=portuguese')
      
      if (!response.ok) return []
      
      const data = await response.json()
      if (!data.items?.length) return []
      
      const offers: OfferDTO[] = []
      
      for (const item of data.items.slice(0, 5)) {
        if (!item?.id || !item?.name) continue
        
        try {
          // Buscar preço atual da Steam API
          const priceResponse = await fetchWithTimeout(`https://store.steampowered.com/api/appdetails/?appids=${item.id}&cc=BR&l=portuguese`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
              'Referer': 'https://store.steampowered.com/'
            }
          }, 15000) // 15 segundos de timeout
          if (!priceResponse.ok) continue
          
          const priceData = await priceResponse.json()
          const gameData = priceData[String(item.id)]
          
          if (!gameData?.success) continue
          
          let priceBase = 0
          let priceFinal = 0
          let discountPct = 0
          
          if (gameData.data.is_free) {
            priceBase = 0
            priceFinal = 0
            discountPct = 0
          } else if (gameData.data.price_overview) {
            const price = gameData.data.price_overview
            priceBase = (price.initial ?? 0) / 100
            priceFinal = (price.final ?? 0) / 100
            discountPct = typeof price.discount_percent === 'number'
              ? Math.max(0, Math.min(100, price.discount_percent))
              : (price.initial && price.initial > 0)
                ? Math.max(0, Math.min(100, Math.round(100 - (price.final / price.initial) * 100)))
                : 0
            if (priceBase < priceFinal) priceBase = priceFinal
          } else {
            continue
          }
          
          const offer: OfferDTO = {
            store: 'steam',
            storeAppId: String(item.id),
            title: item.name,
            url: 'https://store.steampowered.com/app/' + item.id + '/',
            priceBase,
            priceFinal,
            priceBaseCents: Math.round(priceBase * 100),
            priceFinalCents: Math.round(priceFinal * 100),
            discountPct,
            currency: 'BRL',
            isActive: true,
            coverUrl: gameData.data.header_image || item.tiny_image || '',
            genres: [],
            tags: []
          }
          
          offers.push(offer)
          console.log(`✅ Encontrado: ${offer.title} - R$${offer.priceFinal}`)
        } catch (err) {
          console.warn(`Erro ao processar ${item.name}:`, err)
        }
      }
      
      return offers
      
    } catch (error) {
      console.error('❌ Erro na pesquisa Steam:', error)
      return []
    }
  },

  async fetchByIds(ids: string[]): Promise<OfferDTO[]> {
    return []
  }
}
