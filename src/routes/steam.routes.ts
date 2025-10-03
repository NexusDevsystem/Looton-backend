import { FastifyInstance } from 'fastify'
import { z } from 'zod' 
import { getTopDeals } from '../services/offers.service.js'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { fetchSteamFeatured, fetchSteamAppPrice } from '../services/steam-api.service.js'
import { pickImageUrls } from '../utils/imageUtils.js'

export default async function steamRoutes(app: FastifyInstance) {
  // GET /steam/price/:appId - Preço real da Steam com fallback para packages/bundles
  app.get('/steam/price/:appId', async (req: any, reply: any) => {
    const schema = z.object({
      appId: z.string().regex(/^\d+$/).transform(val => parseInt(val))
    })
    
    try {
      const { appId } = schema.parse(req.params)
      console.log(`🔍 Buscando preço REAL do jogo ${appId} na Steam...`)
      
      const priceData = await fetchSteamAppPrice(appId)
      
      if (!priceData) {
        return reply.status(404).send({ error: `Sem price para appId=${appId}` })
      }
      
      console.log(`💰 Preço encontrado: ${priceData.priceFinalBRL} (fonte: ${priceData.source})`)
      return reply.send(priceData)
    } catch (error) {
      console.error('❌ Erro ao buscar preço Steam:', error)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // GET /steam/featured - Ofertas em destaque da Steam (API REAL)
  app.get('/steam/featured', async (req: any, reply: any) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(1000).optional()
    })
    const { limit } = schema.parse(req.query)
    
    try {
      console.log('🔥 Buscando ofertas REAIS da Steam API...')
      const steamItems = await fetchSteamFeatured()
      
      // Mapear para o formato esperado pelo frontend mobile
      const steamDeals = steamItems.slice(0, limit || 50).map((item: any, index: number) => ({
        appId: item.appId || item.packageId || item.bundleId || index,
        title: item.title || 'Jogo sem título',
        url: item.url,
        coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${item.appId || item.packageId || item.bundleId}/header.jpg`,
        priceBaseCents: item.priceBaseCents,
        priceFinalCents: item.priceFinalCents,
        discountPct: item.discountPct || 0
      }))
      
      console.log(`✅ Retornando ${steamDeals.length} ofertas reais da Steam`)
      return reply.send(steamDeals)
    } catch (error) {
      console.error('❌ Erro ao buscar ofertas Steam:', error)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // GET /steam/search - Busca de jogos da Steam diretamente via adapter (sem DB)
  app.get('/steam/search', async (req: any, reply: any) => {
    const schema = z.object({
      q: z.string().min(1),
      limit: z.coerce.number().min(1).max(100).optional()
    })

    try {
      const { q, limit } = schema.parse(req.query)
      const lim = limit || 20

      // Call adapter directly (doesn't persist to DB here)
      let offers = await steamAdapter.search(q)

      // Try to enrich a subset of offers with real Steam prices to avoid heavy load
      const maxFetch = 8
      let fetched = 0
      for (let i = 0; i < offers.length && fetched < maxFetch; i++) {
        const o = offers[i]
  const anyo = o as any
  const id = parseInt(String(anyo.storeAppId || anyo.id || anyo.appid || ''), 10)
        if (!Number.isNaN(id)) {
          try {
            const priceData = await fetchSteamAppPrice(id)
            if (priceData) {
              o.priceFinal = (priceData.priceFinalCents || 0) / 100
              o.priceBase = (priceData.priceBaseCents || 0) / 100
              o.discountPct = priceData.discountPct || 0
            }
          } catch (e) {
            console.error('Erro ao buscar preço para appId', id, e)
          }
          fetched++
        }
      }

      // Map adapter OfferDTO[] to the frontend shape { games: [...] }
      const games = offers.slice(0, lim).map((o: any) => {
        const priceFinal = o.priceFinal || 0
        const priceBase = o.priceBase || 0
        const imageUrls = pickImageUrls({ header_image: o.coverUrl })
        return {
          appId: Number(o.storeAppId) || o.storeAppId,
          title: o.title,
          imageUrl: o.coverUrl || null,
          imageUrls,
          image: imageUrls[0], // compat com UI atual
          // Return numeric prices (unit currency, not cents). Client will format to selected currency.
          price: priceFinal,
          originalPrice: priceBase > priceFinal ? priceBase : priceFinal,
          discount: o.discountPct || 0,
          isFree: priceFinal === 0
        }
      })

      return reply.send({ games })
    } catch (error) {
      console.error('Erro na busca Steam (adapter):', error)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // GET /steam/details/:appId - Detalhes do jogo da Steam
  app.get('/steam/details/:appId', async (req: any, reply: any) => {
    const schema = z.object({
      appId: z.string().regex(/^\d+$/)
    })
    
    try {
      const { appId } = schema.parse(req.params)
      
      // Buscar detalhes reais da Steam API
      const steamApiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=portuguese`
      const response = await fetch(steamApiUrl)
      
      if (!response.ok) {
        return reply.status(404).send({ error: 'Jogo não encontrado' })
      }
      
      const data = await response.json()
      const gameData = data[appId]
      
      if (!gameData || !gameData.success) {
        return reply.status(404).send({ error: 'Jogo não encontrado' })
      }
      
      const game = gameData.data
      
      // Formatar os dados no padrão esperado pelo mobile
      const imageUrls = pickImageUrls(game)
      const gameDetails = {
        appId: parseInt(appId),
        name: game.name,
        imageUrls,
        image: imageUrls[0], // compat com UI atual
        type: game.type,
        required_age: game.required_age,
        is_free: game.is_free,
        detailed_description: game.detailed_description,
        about_the_game: game.about_the_game,
        short_description: game.short_description,
        developers: game.developers || [],
        publishers: game.publishers || [],
        platforms: game.platforms || { windows: true, mac: false, linux: false },
        metacritic: game.metacritic,
        categories: game.categories || [],
        genres: game.genres || [],
        screenshots: game.screenshots || [],
        header_image: game.header_image,
        website: game.website,
        pc_requirements: game.pc_requirements,
        mac_requirements: game.mac_requirements,
        linux_requirements: game.linux_requirements,
        price_overview: game.price_overview,
        packages: game.packages,
        package_groups: game.package_groups,
        achievements: game.achievements,
        release_date: game.release_date,
        support_info: game.support_info,
        background: game.background,
        content_descriptors: game.content_descriptors,
        legal_notice: game.legal_notice
      }
      
      return reply.send(gameDetails)
    } catch (error) {
      console.error('Erro ao buscar detalhes Steam:', error)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })
}