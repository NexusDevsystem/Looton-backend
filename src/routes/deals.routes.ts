import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getTopDeals, getFilteredDeals } from '../services/offers.service.js'
import { fetchDealsBoosted, fetchDealsDefault } from '../services/deals.service.js'

export default async function dealsRoutes(app: FastifyInstance) {
  // GET /deals - Usando dados da Steam API (que já funcionam)
  app.get('/deals', async (req: any, reply: any) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(1000).optional(),
      boost: z.string().optional(), // Parâmetro para preferências de gênero
    })
    const { limit, boost } = schema.parse(req.query)
    
    try {
      // Steam API instável - usando dados mock temporários
      console.log('🔥 Tentando Steam API primeiro...')
      let deals: any[] = []
      
      try {
        const { fetchSteamFeatured } = await import('../services/steam-api.service.js')
        deals = await fetchSteamFeatured()
        console.log(`Steam API retornou: ${deals.length} jogos`)
      } catch (steamError) {
        console.log('Steam API falhou, usando dados mock...')
        deals = []
      }
      
      // Se Steam API falhou, usar dados mock
      if (deals.length === 0) {
        deals = [
          {
            appId: 1174180,
            title: "Red Dead Redemption 2",
            url: "https://store.steampowered.com/app/1174180/",
            coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg",
            priceBaseCents: 29990,
            priceFinalCents: 7497,
            discountPct: 75
          },
          {
            appId: 1086940,
            title: "Baldur's Gate 3",
            url: "https://store.steampowered.com/app/1086940/",
            coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg",
            priceBaseCents: 19999,
            priceFinalCents: 14999,
            discountPct: 25
          },
          {
            appId: 1517290,
            title: "Battlefield 2042",
            url: "https://store.steampowered.com/app/1517290/",
            coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1517290/header.jpg",
            priceBaseCents: 29999,
            priceFinalCents: 5999,
            discountPct: 80
          },
          {
            appId: 1551360,
            title: "Forza Horizon 5",
            url: "https://store.steampowered.com/app/1551360/",
            coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1551360/header.jpg",
            priceBaseCents: 29999,  
            priceFinalCents: 8999,
            discountPct: 70
          },
          {
            appId: 413150,
            title: "Stardew Valley",
            url: "https://store.steampowered.com/app/413150/",
            coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg",
            priceBaseCents: 4999,
            priceFinalCents: 2499,
            discountPct: 50
          }
        ]
        console.log('Usando dados mock temporários')
      }
      
      // Converter para estrutura que o frontend espera (sem buscar gêneros por enquanto para não sobrecarregar)
      const enrichedDeals = deals.slice(0, limit ?? 40).map((deal: any) => {
        // Gêneros mockados baseados no título para teste
        let mockGenres: Array<{ id: string; name: string }> = []
        const title = deal.title.toLowerCase()
        
        if (title.includes('red dead') || title.includes('gta') || title.includes('battlefield')) {
          mockGenres = [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }]
        } else if (title.includes('baldur') || title.includes('witcher') || title.includes('divinity')) {
          mockGenres = [{ id: '3', name: 'RPG' }, { id: '2', name: 'Aventura' }]
        } else if (title.includes('forza') || title.includes('racing') || title.includes('driver')) {
          mockGenres = [{ id: '6', name: 'Corrida' }, { id: '9', name: 'Esportes' }]
        } else if (title.includes('civilization') || title.includes('total war') || title.includes('age of')) {
          mockGenres = [{ id: '10', name: 'Estratégia' }]
        } else if (title.includes('stardew') || title.includes('farm') || title.includes('sim')) {
          mockGenres = [{ id: '23', name: 'Indie' }, { id: '18', name: 'Simulação' }]
        } else {
          mockGenres = [{ id: '1', name: 'Ação' }] // Default
        }
        
        // Precise pricing from cents
        const priceBaseCents = Number(deal.priceBaseCents || 0)
        const priceFinalCents = Number(deal.priceFinalCents || 0)
        const priceBase = priceBaseCents > 0 ? Number((priceBaseCents / 100).toFixed(2)) : 0
        const priceFinal = priceFinalCents > 0 ? Number((priceFinalCents / 100).toFixed(2)) : 0

        return {
          _id: deal.appId?.toString() || Math.random().toString(),
          appId: deal.appId,
          url: deal.url,
          priceBaseCents,
          priceFinalCents,
          priceBase,
          priceFinal,
          discountPct: deal.discountPct,
          steamGenres: mockGenres,
          game: {
            title: deal.title,
            coverUrl: deal.coverUrl || `https://cdn.akamai.steamstatic.com/steam/apps/${deal.appId}/header.jpg`,
            genres: mockGenres.map(g => g.name),
            tags: []
          },
          store: {
            name: 'Steam'
          }
        }
      })

      // Se boost foi fornecido, aplicar priorização
      if (boost && boost.length > 0) {
        const preferredGenres = boost.split(',').map(g => g.trim().toLowerCase())
        
        const boostedDeals = enrichedDeals.map((deal: any) => {
          let score = deal.discountPct // Score base = desconto
          
          // Boost para jogos com gêneros preferidos
          if (deal.steamGenres && deal.steamGenres.length > 0) {
            const hasPreferredGenre = deal.steamGenres.some((genre: any) => 
              preferredGenres.some(preferred => 
                genre.name.toLowerCase().includes(preferred) ||
                preferred.includes(genre.name.toLowerCase())
              )
            )
            
            if (hasPreferredGenre) {
              score += 50 // Boost significativo para gêneros preferidos
            }
          }
          
          return { ...deal, score }
        })
        
        // Ordenar por score (maior primeiro)
        boostedDeals.sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        
        return reply.send(boostedDeals)
      }
      
      return reply.send(enrichedDeals)
      
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

    const filters = schema.parse(req.query)
    const deals = await getFilteredDeals(filters)
    return reply.send(deals)
  })
}
