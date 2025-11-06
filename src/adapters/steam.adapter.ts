import { OfferDTO, StoreAdapter } from './types.js'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'

// Cache curto por região/idioma (5 minutos)
const specialsCache = new MemoryCache<string, OfferDTO[]>(ttlSecondsToMs(300))

// Cache para detalhes de apps (incluindo genres/categories)
const appDetailsCache = new MemoryCache<string, any>(ttlSecondsToMs(3600)) // 1 hora

function key(cc: string, l: string) {
  return `${cc}|${l}`.toLowerCase()
}

/**
 * Busca detalhes completos de um app na Steam, incluindo gêneros, categorias, tags e dados de conteúdo
 */
async function fetchAppDetails(appId: string, cc: string = 'BR', l: string = 'pt-BR'): Promise<{ 
  genres: string[], 
  categories: string[], 
  tags: string[],
  required_age?: number,
  content_descriptors?: string[]
} | null> {
  const cacheKey = `${appId}:${cc}:${l}`
  
  // Verificar cache primeiro
  const cached = appDetailsCache.get(cacheKey)
  if (cached) return cached
  
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${appId}&cc=${cc}&l=${l}`)
    if (!response.ok) return null
    
    const data = await response.json()
    const appData = data[appId]
    
    if (!appData?.success || !appData.data) return null
    
    const gameData = appData.data
    
    const genres = (gameData.genres || []).map((g: any) => g?.description || '').filter(Boolean)
    const categories = (gameData.categories || []).map((c: any) => c?.description || '').filter(Boolean)
    
    // Tags da Steam (se disponível)
    const tags: string[] = []
    if (gameData.genres) {
      tags.push(...genres) // Gêneros também são tags
    }
    if (gameData.categories) {
      // Algumas categorias são tags importantes (ex: "Single-player", "Multi-player")
      tags.push(...categories)
    }
    
    // Dados de conteúdo para NSFW Shield
    const required_age = gameData.required_age || 0
    const content_descriptors = gameData.content_descriptors?.ids || []
    
    const result = { 
      genres, 
      categories, 
      tags,
      required_age,
      content_descriptors
    }
    appDetailsCache.set(cacheKey, result)
    
    return result
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar detalhes do app ${appId}:`, error)
    return null
  }
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
      const res = await fetch(url)
      if (!res.ok) return []
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

        // Exclude Assassin's Creed Black Flag - Golden Edition which doesn't exist on Steam
        const titleLower = it.name.toLowerCase();
        const isAssassinBlackFlagGolden = titleLower.includes('assassin\'s creed black flag') && titleLower.includes('golden edition');
        
        if (!isAssassinBlackFlagGolden) {
          // Criar oferta SEM buscar detalhes (para velocidade)
          // Detalhes serão buscados apenas quando necessário (ex: ao abrir o jogo)
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
            genres: [], // Será preenchido por consolidated-deals.service.ts
            tags: []    // Será preenchido por consolidated-deals.service.ts
          }
          offers.push(offer)
        }
      }

      // Ordenar: maior desconto primeiro, depois menor preço
      offers.sort((a, b) => ((b.discountPct ?? 0) - (a.discountPct ?? 0)) || (a.priceFinal - b.priceFinal))

      // NOTA: Enriquecimento com fetchAppDetails DESABILITADO (causa timeout)
      // NSFW Shield vai usar apenas Layer 0 (bloqueio por título)
      console.log(`✅ ${offers.length} ofertas da Steam carregadas (sem enriquecimento)`)

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
          const priceResponse = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${item.id}&cc=BR&l=portuguese`)
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
          
          // Exclude Assassin's Creed Black Flag - Golden Edition which doesn't exist on Steam
          const titleLower = item.name.toLowerCase();
          const isAssassinBlackFlagGolden = titleLower.includes('assassin\'s creed black flag') && titleLower.includes('golden edition');
          
          if (!isAssassinBlackFlagGolden) {
            // Extrair gêneros e categorias do appdetails que já foi buscado
            const genres = (gameData.data.genres || []).map((g: any) => g?.description || '').filter(Boolean)
            const categories = (gameData.data.categories || []).map((c: any) => c?.description || '').filter(Boolean)
            const allTags = [...new Set([...genres, ...categories])]
            
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
              genres: allTags,
              tags: allTags
            }
            
            offers.push(offer)
            console.log(`✅ Encontrado: ${offer.title} - R${offer.priceFinal} | Gêneros: ${allTags.join(', ') || 'N/A'}`)
          }
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
