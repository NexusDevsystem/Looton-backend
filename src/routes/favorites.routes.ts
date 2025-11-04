import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { favoritesPersistence } from '../services/persistence/favorites-persistence.service.js'

// Cache em memória para favoritos (sem MongoDB)
// Exportado para ser acessado pelo job de jogos vigiados
export const favoritesCache = new Map<string, any[]>()

// Flag para controlar se já carregou do Redis
let isLoaded = false

// Função para carregar favoritos do Redis na inicialização
async function loadFavoritesFromRedis() {
  if (isLoaded) return
  
  console.log('[Favorites] 🔄 Carregando favoritos do Redis...')
  const allFavorites = await favoritesPersistence.loadAll()
  
  for (const [userId, favorites] of allFavorites.entries()) {
    favoritesCache.set(userId, favorites)
  }
  
  isLoaded = true
  console.log(`[Favorites] ✅ Carregados favoritos de ${allFavorites.size} usuários do Redis`)
}

export default async function favoritesRoutes(app: FastifyInstance) {
  // Carregar favoritos do Redis ao iniciar
  await loadFavoritesFromRedis()
  
  // POST /favorites - Criar favorito (sem MongoDB)
  app.post('/favorites', async (req: any, reply: any) => {
    console.log('📝 POST favorites - cache em memória')
    
    const schema = z.object({
      userId: z.string(),
      gameId: z.string(),
      stores: z.array(z.string()).optional(),
      notifyUp: z.boolean().optional(),
      notifyDown: z.boolean().optional(),
      pctThreshold: z.number().min(1).max(100).optional(),
      desiredPriceCents: z.number().int().min(0).optional(),
      listId: z.string().optional()
    })

    try {
      const data = schema.parse(req.body)
      
      // Buscar favoritos existentes do usuário
      const userFavorites = favoritesCache.get(data.userId) || []
      
      // Verificar se já existe
      const existingIndex = userFavorites.findIndex(f => f.gameId === data.gameId)
      if (existingIndex !== -1) {
        return reply.status(409).send({ error: 'Jogo já está nos favoritos' })
      }
      
      // Criar novo favorito
      const newFavorite = {
        _id: `fav_${Date.now()}_${Math.random()}`,
        userId: data.userId,
        gameId: data.gameId,
        stores: data.stores || ['steam'],
        notifyUp: data.notifyUp || false,
        notifyDown: data.notifyDown || false,
        pctThreshold: data.pctThreshold || 10,
        desiredPriceCents: data.desiredPriceCents || 0,
        listId: data.listId,
        createdAt: new Date()
      }

      // Adicionar ao cache
      userFavorites.push(newFavorite)
      favoritesCache.set(data.userId, userFavorites)

      // Salvar no Redis (async)
      favoritesPersistence.save(data.userId, userFavorites).catch(err => {
        console.error('[Favorites] Erro ao salvar no Redis:', err)
      })

      return reply.status(201).send(newFavorite)
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /favorites - Buscar favoritos do usuário (sem MongoDB)
  app.get('/favorites', async (req: any, reply: any) => {
    console.log('📋 GET favorites - cache em memória')
    
    const schema = z.object({
      userId: z.string(),
      store: z.string().optional(),
      changed: z.enum(['down', 'up']).optional()
    })

    try {
      const { userId, store } = schema.parse(req.query)
      
      // Buscar favoritos do cache
      let favorites = favoritesCache.get(userId) || []
      
      // Filtrar por store se especificado
      if (store) {
        favorites = favorites.filter(f => f.stores?.includes(store))
      }
      
      // Ordenar por data de criação (mais recente primeiro)
      favorites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return reply.send(favorites)
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // DELETE /favorites/:id - Remover favorito (sem MongoDB)
  app.delete('/favorites/:id', async (req: any, reply: any) => {
    console.log('🗑️ DELETE favorites - cache em memória')
    
    const schema = z.object({
      id: z.string()
    })

    try {
      const { id } = schema.parse(req.params)
      
      // Procurar em todos os usuários
      let found = false
      let foundUserId = ''
      for (const [userId, userFavorites] of favoritesCache.entries()) {
        const index = userFavorites.findIndex(f => f._id === id)
        if (index !== -1) {
          userFavorites.splice(index, 1)
          favoritesCache.set(userId, userFavorites)
          foundUserId = userId
          found = true
          break
        }
      }
      
      if (!found) {
        return reply.status(404).send({ error: 'Favorito não encontrado' })
      }

      // Salvar no Redis (async)
      if (foundUserId) {
        const updatedFavorites = favoritesCache.get(foundUserId) || []
        favoritesPersistence.save(foundUserId, updatedFavorites).catch(err => {
          console.error('[Favorites] Erro ao salvar no Redis:', err)
        })
      }

      return reply.status(204).send()
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // PATCH /favorites/:id - Atualizar favorito (sem MongoDB)
  app.patch('/favorites/:id', async (req: any, reply: any) => {
    console.log('✏️ PATCH favorites - cache em memória')
    
    const schema = z.object({
      id: z.string()
    })

    const bodySchema = z.object({
      stores: z.array(z.string()).optional(),
      notifyUp: z.boolean().optional(),
      notifyDown: z.boolean().optional(),
      pctThreshold: z.number().min(1).max(100).optional(),
      desiredPriceCents: z.number().int().min(0).optional(),
      listId: z.string().optional()
    })

    try {
      const { id } = schema.parse(req.params)
      const data = bodySchema.parse(req.body)

      // Procurar em todos os usuários
      let updatedFavorite = null
      let foundUserId = ''
      for (const [userId, userFavorites] of favoritesCache.entries()) {
        const index = userFavorites.findIndex(f => f._id === id)
        if (index !== -1) {
          // Atualizar campos
          if (data.stores !== undefined) userFavorites[index].stores = data.stores
          if (data.notifyUp !== undefined) userFavorites[index].notifyUp = data.notifyUp
          if (data.notifyDown !== undefined) userFavorites[index].notifyDown = data.notifyDown
          if (data.pctThreshold !== undefined) userFavorites[index].pctThreshold = data.pctThreshold
          if (data.desiredPriceCents !== undefined) userFavorites[index].desiredPriceCents = data.desiredPriceCents
          if (data.listId !== undefined) userFavorites[index].listId = data.listId
          
          favoritesCache.set(userId, userFavorites)
          updatedFavorite = userFavorites[index]
          foundUserId = userId
          break
        }
      }

      if (!updatedFavorite) {
        return reply.status(404).send({ error: 'Favorito não encontrado' })
      }

      // Salvar no Redis (async)
      if (foundUserId) {
        const updatedFavorites = favoritesCache.get(foundUserId) || []
        favoritesPersistence.save(foundUserId, updatedFavorites).catch(err => {
          console.error('[Favorites] Erro ao salvar no Redis:', err)
        })
      }

      return reply.send(updatedFavorite)
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // POST /favorites/sync - Sincronizar favoritos em lote (sem MongoDB)
  app.post('/favorites/sync', async (req: any, reply: any) => {
    console.log('🔄 POST favorites/sync - cache em memória')
    
    const schema = z.object({
      userId: z.string(),
      favorites: z.array(z.object({
        gameId: z.string(),
        stores: z.array(z.string()).optional(),
        notifyUp: z.boolean().optional(),
        notifyDown: z.boolean().optional(),
        pctThreshold: z.number().min(1).max(100).optional(),
        desiredPriceCents: z.number().int().min(0).optional(),
        listId: z.string().optional()
      }))
    })

    try {
      const data = schema.parse(req.body)
      const results: any[] = []

      // Buscar favoritos existentes do usuário
      const userFavorites = favoritesCache.get(data.userId) || []

      for (const f of data.favorites) {
        // Buscar se já existe
        const existingIndex = userFavorites.findIndex(existing => existing.gameId === f.gameId)
        
        if (existingIndex !== -1) {
          // Atualizar existente
          const existing = userFavorites[existingIndex]
          if (f.stores !== undefined) existing.stores = f.stores
          if (f.notifyUp !== undefined) existing.notifyUp = f.notifyUp
          if (f.notifyDown !== undefined) existing.notifyDown = f.notifyDown
          if (f.pctThreshold !== undefined) existing.pctThreshold = f.pctThreshold
          if (f.desiredPriceCents !== undefined) existing.desiredPriceCents = f.desiredPriceCents
          if (f.listId !== undefined) existing.listId = f.listId
          
          results.push(existing)
        } else {
          // Criar novo
          const newFavorite = {
            _id: `fav_${Date.now()}_${Math.random()}`,
            userId: data.userId,
            gameId: f.gameId,
            stores: f.stores || ['steam'],
            notifyUp: f.notifyUp || false,
            notifyDown: f.notifyDown || false,
            pctThreshold: f.pctThreshold || 10, 
            desiredPriceCents: f.desiredPriceCents || 0,
            listId: f.listId,
            createdAt: new Date()
          }
          
          userFavorites.push(newFavorite)
          results.push(newFavorite)
        }
      }

      // Salvar no cache
      favoritesCache.set(data.userId, userFavorites)

      return reply.send({ synced: results.length, favorites: results })
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // Debug endpoint para testar notificação de jogos vigiados
  app.post('/debug/test-watched-games', async (req: any, reply: any) => {
    try {
      const { runWatchedGamesNotification, getWatchedGamesHistory } = await import('../jobs/watchedGames.job.js')
      
      console.log('🧪 Executando teste de notificações de jogos vigiados...')
      await runWatchedGamesNotification()
      
      const history = getWatchedGamesHistory()
      
      return reply.send({ 
        success: true, 
        message: 'Verificação de jogos vigiados concluída',
        notificationsSent: history.length,
        lastNotifications: history.slice(-5)
      })
    } catch (error: any) {
      console.error('Erro ao testar watched games:', error)
      return reply.status(500).send({ error: error.message })
    }
  })

  // Debug endpoint para limpar cache de preços
  app.post('/debug/clear-price-cache', async (req: any, reply: any) => {
    try {
      const { clearPriceCache } = await import('../jobs/watchedGames.job.js')
      clearPriceCache()
      
      return reply.send({ 
        success: true, 
        message: 'Cache de preços limpo'
      })
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })

  // Debug endpoint para obter histórico de notificações
  app.get('/debug/watched-games-history', async (req: any, reply: any) => {
    try {
      const { getWatchedGamesHistory } = await import('../jobs/watchedGames.job.js')
      const history = getWatchedGamesHistory()
      
      return reply.send({ 
        total: history.length,
        history: history.slice(-20) // últimas 20
      })
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })

  // Debug endpoint para ver usuários no tracker
  app.get('/debug/user-tracker', async (req: any, reply: any) => {
    try {
      const { userActivityTracker } = await import('../services/user-activity.service.js')
      const allUsers = await userActivityTracker.getAllUsers()
      
      return reply.send({
        total: allUsers.length,
        users: allUsers.map(u => ({
          userId: u.userId,
          hasPushToken: !!u.pushToken,
          pushToken: u.pushToken?.substring(0, 30) + '...',
          lastActiveAt: u.lastActiveAt,
          daysSinceActive: Math.floor((Date.now() - u.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
        }))
      })
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })

  // Debug endpoint para testar Daily Offer manualmente
  app.post('/debug/test-daily-offer', async (req: any, reply: any) => {
    try {
      const { runDailyOfferNotification, getDailyOfferHistory } = await import('../jobs/dailyOffer.job.js')
      
      console.log('🧪 Executando teste de Oferta do Dia...')
      await runDailyOfferNotification()
      
      const history = getDailyOfferHistory()
      
      return reply.send({ 
        success: true, 
        message: 'Oferta do Dia enviada',
        notificationsSent: history.length > 0 ? history[history.length - 1].sentTo : 0,
        lastNotification: history.slice(-1)[0]
      })
    } catch (error: any) {
      console.error('Erro ao testar daily offer:', error)
      return reply.status(500).send({ error: error.message })
    }
  })

  // Debug endpoint para ver histórico de Daily Offers
  app.get('/debug/daily-offer-history', async (req: any, reply: any) => {
    try {
      const { getDailyOfferHistory } = await import('../jobs/dailyOffer.job.js')
      const history = getDailyOfferHistory()
      
      return reply.send({ 
        total: history.length,
        history: history.slice(-10) // últimas 10
      })
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })
}