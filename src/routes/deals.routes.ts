import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fetchConsolidatedDeals } from '../services/consolidated-deals.service.js'
import { filterNSFWGames } from '../utils/nsfw-shield.js'
import { filterGamesWithAI } from '../services/content-ai-classifier.service.js'
import { filterByCategory, type GameCategory } from '../utils/game-categories.js'

export default async function dealsRoutes(app: FastifyInstance) {


  // GET /deals - Usando dados consolidados de Steam e Epic Games
  app.get('/deals', async (req: any, reply: any) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(1000).optional(),
      boost: z.string().optional(), // Parâmetro para preferências de gênero
      cc: z.string().length(2).optional(),
      l: z.string().optional(),
      useDailyRotation: z.coerce.boolean().optional(), // Parâmetro para controlar rotação diária
      category: z.enum(['racing', 'fps', 'survival', 'sports']).optional(), // Filtro por categoria
    })
    const { limit, boost, cc, l, useDailyRotation, category } = schema.parse(req.query)
    
    try {
      console.log('🎮 Buscando deals com preços ao vivo da Steam...')
      
      // Usar serviço consolidado que já busca preços atuais
      const deals = await fetchConsolidatedDeals(limit || 30, { cc, l, useDailyRotation }) // Passar o parâmetro useDailyRotation
      
      console.log(`✅ Deals consolidados retornados: ${deals.length} jogos únicos`)
      
      // 🛡️ NSFW Shield - Sistema multi-camadas
      const nsfwFiltered = filterNSFWGames(deals)
      console.log(`🛡️ NSFW filtrados: ${nsfwFiltered.length} seguros de ${deals.length} total (${deals.length - nsfwFiltered.length} removidos)`)

      // 🤖 AI Content Classifier - Análise profunda de conteúdo adulto
      const safeDeals = filterGamesWithAI(nsfwFiltered)
      console.log(`🤖 AI filtrados: ${safeDeals.length} seguros de ${nsfwFiltered.length} total (${nsfwFiltered.length - safeDeals.length} removidos)`)
      
      // Se não houver deals, retornar array vazio
      if (safeDeals.length === 0) {
        return reply.send([])
      }
      
      // Converter os deals consolidados para o formato que o frontend espera
      const formattedDeals = safeDeals.map((deal: any) => {
        // Encontrar a loja com REALMENTE o menor preço válido
        const bestStore = deal.stores
          // Permitir preços 0 (gratuitos) e valores válidos não negativos
          .filter((s: any) => typeof s.priceFinal === 'number' && s.priceFinal >= 0)
          .sort((a: any, b: any) => a.priceFinal - b.priceFinal)[0] || deal.stores[0]
        
        // Usar ID da loja com melhor preço para consistência
  const appId = bestStore.storeAppId
  const uniqueId = deal.id || appId // usa id consolidado (app:/package:/bundle:)
        
        // Preços corretos da loja com melhor preço - bestStore já tem preços em reais
  const priceBaseCents = Math.round(((bestStore.priceBase ?? bestStore.priceFinal ?? 0) as number) * 100)
  const priceFinalCents = Math.round(((bestStore.priceFinal ?? 0) as number) * 100)
        
        // Gêneros baseados no título
        let mockGenres: Array<{ id: string; name: string }> = []
        const title = deal.title.toLowerCase()
        
        if (title.includes('cyberpunk') || title.includes('grand theft') || title.includes('borderlands')) {
          mockGenres = [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }]
        } else if (title.includes('witcher') || title.includes('baldur') || title.includes('divinity')) {
          mockGenres = [{ id: '3', name: 'RPG' }, { id: '2', name: 'Aventura' }]
        } else if (title.includes('fortnite') || title.includes('rocket league') || title.includes('fall guys')) {
          mockGenres = [{ id: '4', name: 'Multiplayer' }, { id: '5', name: 'Casual' }]
        } else if (title.includes('red dead') || title.includes('gta') || title.includes('battlefield')) {
          mockGenres = [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }]
        } else if (title.includes('elden ring') || title.includes('dark souls')) {
          mockGenres = [{ id: '1', name: 'Ação' }, { id: '3', name: 'RPG' }]
        } else {
          mockGenres = [{ id: '1', name: 'Ação' }]
        }
        
        return {
          _id: uniqueId,
          appId: isNaN(Number(appId)) ? appId : parseInt(appId), // Manter como string se não for número
          url: bestStore.url,
          priceBaseCents,
          priceFinalCents,
          priceBase: Number((priceBaseCents / 100).toFixed(2)),
          priceFinal: Number((priceFinalCents / 100).toFixed(2)),
          discountPct: bestStore.discountPct || 0,
          currency: deal.currency || 'BRL',
          steamGenres: mockGenres,
          releaseDate: deal.releaseDate, // Adicionando a data de lançamento
          imageUrls: deal.coverUrl ? [`/thumb?url=${encodeURIComponent(deal.coverUrl)}&w=640`] : [],
          image: deal.coverUrl ? `/thumb?url=${encodeURIComponent(deal.coverUrl)}&w=640` : '',
          game: {
            title: deal.title,
            coverUrl: deal.coverUrl,
            genres: deal.genres || mockGenres.map(g => g.name),
            tags: deal.tags || []
          },
          store: {
            name: bestStore.store === 'steam' ? 'Steam' : bestStore.store === 'epic' ? 'Epic Games' : 'Unknown'
          },
          // Informações sobre múltiplas lojas para exibir no card
          totalStores: deal.totalStores || 1,
          allStores: deal.stores.map((s: any) => ({
            name: s.store === 'steam' ? 'Steam' : s.store === 'epic' ? 'Epic Games' : s.store,
            price: Number((s.priceFinal || 0).toFixed(2)),
            priceBase: Number((s.priceBase || 0).toFixed(2)),
            discount: s.discountPct || 0,
            url: s.url,
            storeAppId: s.storeAppId
          })),
          // Para debug - dados brutos do deal consolidado
          originalDeal: {
            id: deal.id,
            title: deal.title,
            bestStore: deal.bestPrice?.store || 'steam'
          }
        }
      })

      // Filtrar por categoria se especificado
      let finalDeals = formattedDeals
      if (category) {
        console.log(`🎯 Filtrando por categoria: ${category}`)
        finalDeals = filterByCategory(formattedDeals, category as GameCategory)

        // Quando filtrar por categoria, mostrar APENAS jogos em promoção e pagos
        finalDeals = finalDeals.filter(deal => {
          const isOnSale = (deal.discountPct || 0) > 0
          const isPaid = (deal.priceFinalCents || 0) > 0
          return isOnSale && isPaid
        })

        console.log(`✅ ${finalDeals.length} jogos encontrados na categoria ${category} (apenas em promoção e pagos)`)
      }

      // Retornar array diretamente como o frontend espera
      return reply.send(finalDeals)
      
    } catch (error) {
      console.error('Erro ao buscar deals:', error)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // GET /deals/filter - Filtragem avançada de ofertas
  app.get('/deals/filter', async (req: any, reply: any) => {
    const schema = z.object({
      genres: z.string().optional().transform(val => val ? val.split(',').map(g => g.trim()) : undefined),
      tags: z.string().optional().transform(val => val ? val.split(',').map(t => t.trim()) : undefined),
      stores: z.string().optional().transform(val => val ? val.split(',').map(s => s.trim()) : undefined),
      minDiscount: z.coerce.number().min(0).max(100).optional(),
      maxPrice: z.coerce.number().min(0).optional(), // Em centavos
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(100).optional()
    })

    // TEMPORARIAMENTE DESABILITADO - usar apenas /deals principal
    return reply.send([])
  })

  // GET /deals/consolidated - Ofertas consolidadas de múltiplas lojas
  app.get('/deals/consolidated', async (req: any, reply: any) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(100).default(50),
      useDailyRotation: z.coerce.boolean().optional(), // Parâmetro para controlar rotação diária
    })
    
    const { limit, useDailyRotation } = schema.parse(req.query)
    
    try {
  const consolidatedDeals = await fetchConsolidatedDeals(limit, { useDailyRotation }) // Passar o parâmetro useDailyRotation
      
      // Converter para formato compatível com o frontend
      const formattedDeals = consolidatedDeals.map(deal => ({
        _id: deal.id,
        appId: isNaN(Number(deal.stores[0]?.storeAppId)) ? deal.stores[0]?.storeAppId || deal.id : parseInt(deal.stores[0]?.storeAppId),
        title: deal.title,
        url: deal.stores[0]?.url || '#',
        coverUrl: deal.coverUrl,
        imageUrls: deal.coverUrl ? [deal.coverUrl] : [],
        image: deal.coverUrl,
  priceBase: Math.round((deal.bestPrice?.price ?? 0) * 100), // Frontend espera em centavos
  priceFinal: Math.round((deal.bestPrice?.price ?? 0) * 100),
  priceBaseCents: deal.stores.reduce((max, store) => Math.max(max, Math.round((store.priceBase ?? 0) * 100)), 0),
  priceFinalCents: Math.round((deal.bestPrice?.price ?? 0) * 100),
  discountPct: deal.bestPrice?.discountPct ?? 0,
        steamGenres: deal.genres?.map((genre, index) => ({ id: index.toString(), name: genre })) || [],
        game: {
          title: deal.title,
          coverUrl: deal.coverUrl,
          genres: deal.genres || [],
          tags: deal.tags || []
        },
        stores: deal.stores.map(store => ({
          name: store.store.charAt(0).toUpperCase() + store.store.slice(1),
          url: store.url,
          price: store.priceFinal,
          priceBase: store.priceBase,
          discountPct: store.discountPct,
          storeAppId: store.storeAppId
        })),
        totalStores: deal.totalStores,
        bestStore: deal.bestPrice.store
      }))

      return reply.send(formattedDeals)
      
    } catch (error) {
      console.error('❌ Erro ao buscar ofertas consolidadas:', error)
      return reply.code(500).send({ error: 'Failed to fetch consolidated deals' })
    }
  })
}
