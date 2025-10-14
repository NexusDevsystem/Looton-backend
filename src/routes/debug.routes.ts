import { FastifyInstance } from 'fastify'
import { upsertOffersAndNotify } from '../services/offers.service.js'
import { OfferDTO } from '../adapters/types.js'

// Simple in-memory store for debug push tokens. Not for production.
const debugPushTokens = new Map<string, string>()

export default async function debugRoutes(app: FastifyInstance) {
  app.post('/push/register', async (request, reply) => {
    const body = request.body as { userId?: string; pushToken: string }
    if (!body?.pushToken) return reply.status(400).send({ message: 'pushToken required' })
    const key = body.userId || 'anonymous'
    debugPushTokens.set(key, body.pushToken)
    return reply.send({ ok: true })
  })

  // Trigger an offer ingestion for testing notifications.
  app.post('/debug/trigger', async (request, reply) => {
    const body = request.body as any

    if (!body || !body.store || typeof body.priceFinal !== 'number')
      return reply.status(400).send({ message: 'store and priceFinal required' })

    const dto: OfferDTO = {
      store: body.store,
      storeAppId: body.storeAppId ? String(body.storeAppId) : '0',
      title: body.title || 'DEBUG GAME',
      url: body.url || '',
      priceBase: body.priceBase ?? body.priceFinal,
      priceFinal: body.priceFinal,
      priceBaseCents: Math.round((body.priceBase ?? body.priceFinal) * 100),
      priceFinalCents: Math.round(body.priceFinal * 100),
      currency: 'BRL',
      discountPct: body.discountPct ?? Math.round(((body.priceBase ?? body.priceFinal) - body.priceFinal) / (body.priceBase ?? body.priceFinal) * 100),
      isActive: true,
      coverUrl: body.coverUrl || ''
    }

    // If a pushToken is provided, register it under the anonymous key so notification send path can pick it up.
    if (body.pushToken) debugPushTokens.set(body.userId || 'anonymous', body.pushToken)

    try {
      await upsertOffersAndNotify([dto])
      return reply.send({ ok: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'failed to process' })
    }
  })

  // Endpoint para popular gêneros Steam nos jogos existentes
  app.post('/debug/populate-genres', async (request, reply) => {
    try {
      const { Game } = await import('../db/models/Game.js')
      
      // Mapear jogos por steamAppId para seus gêneros
      const gameGenresMap: Record<string, Array<{ id: string; name: string }>> = {
        '730': [{ id: '1', name: 'Ação' }, { id: '13', name: 'Luta' }],
        '292030': [{ id: '7', name: 'RPG' }, { id: '2', name: 'Aventura' }],
        '1551360': [{ id: '6', name: 'Corrida' }, { id: '9', name: 'Esportes' }],
        '413150': [{ id: '4', name: 'Indie' }, { id: '8', name: 'Simulação' }],
        '289070': [{ id: '10', name: 'Estratégia' }],
        '1517290': [{ id: '1', name: 'Ação' }, { id: '5', name: 'Multijogador Massivo' }],
        '1203220': [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }]
      }
      
      // Também buscar por títulos para garantir que peguemos todos os jogos
      const gameTitleGenresMap: Record<string, Array<{ id: string; name: string }>> = {
        'Forza Horizon 5': [{ id: '6', name: 'Corrida' }, { id: '9', name: 'Esportes' }],
        'Counter-Strike 2': [{ id: '1', name: 'Ação' }, { id: '13', name: 'Luta' }],
        'The Witcher 3': [{ id: '7', name: 'RPG' }, { id: '2', name: 'Aventura' }],
        'Stardew Valley': [{ id: '4', name: 'Indie' }, { id: '8', name: 'Simulação' }],
        'Civilization VI': [{ id: '10', name: 'Estratégia' }],
        'Battlefield 2042': [{ id: '1', name: 'Ação' }, { id: '5', name: 'Multijogador Massivo' }],
        'Naraka: Bladepoint': [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }]
      }
      
      let updated = 0
      
      // Atualizar cada jogo com seus gêneros Steam por steamAppId
      for (const [steamAppId, steamGenres] of Object.entries(gameGenresMap)) {
        const result = await Game.updateMany(
          {
            $or: [
              { steamAppId: parseInt(steamAppId) },
              { storeAppId: steamAppId }
            ]
          },
          {
            $set: { steamGenres }
          }
        )
        updated += result.modifiedCount
        console.log(`Atualizado ${result.modifiedCount} jogos para steamAppId ${steamAppId}`)
      }
      
      // Atualizar jogos por título também (fallback)
      for (const [title, steamGenres] of Object.entries(gameTitleGenresMap)) {
        const result = await Game.updateMany(
          {
            title: { $regex: title, $options: 'i' }
          },
          {
            $set: { steamGenres }
          }
        )
        updated += result.modifiedCount
        console.log(`Atualizado ${result.modifiedCount} jogos para título ${title}`)
      }
      
      return reply.send({ 
        ok: true, 
        message: `${updated} jogos atualizados com gêneros Steam`,
        updated 
      })
      
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'failed to populate genres', error: err })
    }
  })

  // Endpoint para criar usuário de teste com preferências
  app.post('/debug/create-test-user', async (request, reply) => {
    try {
      const { User } = await import('../db/models/User.js')
      const body = request.body as { preferences?: { preferredSteamGenreIds: string[] } }
      
      // Criar ou atualizar usuário de teste
      const testUser = await User.findOneAndUpdate(
        { email: 'test@looton.app' },
        {
          email: 'test@looton.app',
          name: 'Test User',
          preferences: body.preferences || {
            preferredSteamGenreIds: ['6'], // Corrida como padrão
            minDiscount: 0,
            stores: []
          }
        },
        { upsert: true, new: true }
      )
      
      return reply.send({ 
        ok: true, 
        userId: testUser._id.toString(),
        preferences: testUser.preferences 
      })
      
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'failed to create test user', error: err })
    }
  })

  // Endpoint para testar sistema de boost
  app.get('/debug/test-boost/:userId', async (request, reply) => {
    try {
      const { fetchDealsBoosted } = await import('../services/deals.service.js')
      const userId = (request.params as any).userId
      
      if (!userId) {
        return reply.status(400).send({ message: 'userId required' })
      }
      
      const deals = await fetchDealsBoosted(userId, 10)
      
      return reply.send({ 
        ok: true, 
        count: deals.length,
        deals: deals.map(d => ({
          title: d.title,
          score: d.score,
          genres: d.steamGenres?.map(g => g.name) || [],
          discount: d.discountPct
        }))
      })
      
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'failed to test boost', error: err })
    }
  })
  
  // Nova rota para testar notificação com mais detalhes
  app.post('/debug/test-notification-detailed', async (req: any, reply: any) => {
    const { token, title, body, userId } = req.body
    
    if (!token && !userId) {
      return reply.status(400).send({ error: 'Token ou userId é necessário' })
    }
    
    try {
      // Se userId for fornecido, buscar o token do usuário
      let finalToken = token
      if (userId) {
        const User = (await import('../db/models/User.js')).User
        const user = await User.findById(userId).lean()
        if (!user?.pushToken) {
          return reply.status(400).send({ error: 'Usuário não encontrado ou não tem pushToken' })
        }
        finalToken = user.pushToken
      }
      
      // Validar token
      const Expo = (await import('expo-server-sdk')).Expo
      if (!Expo.isExpoPushToken(finalToken)) {
        return reply.status(400).send({ error: 'Token inválido' })
      }
      
      // Enviar notificação
      const { sendPush } = await import('../services/notification.service.js')
      const success = await sendPush(finalToken, title || 'Teste', body || 'Notificação de teste', { 
        test: true,
        timestamp: new Date().toISOString()
      })
      
      return reply.send({ success, tokenPreview: finalToken.substring(0, 20) + '...' })
    } catch (error) {
      console.error('Erro no teste detalhado de notificação:', error)
      return reply.status(500).send({ error: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  })
}

export { debugPushTokens }

