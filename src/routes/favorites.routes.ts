import { z } from 'zod'

// Cache em memória para favoritos (sem MongoDB)
const favoritesCache = new Map<string, any[]>()

export default async function favoritesRoutes(app: any) {
  // POST /favorites - Criar favorito (sem MongoDB)
  app.post('/favorites', async (req: any, res: any) => {
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
        return res.status(409).send({ error: 'Jogo já está nos favoritos' })
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

      return res.status(201).send(newFavorite)
    } catch (error: any) {
      return res.status(400).send({ error: error.message })
    }
  })

  // GET /favorites - Buscar favoritos do usuário (sem MongoDB)
  app.get('/favorites', async (req: any, res: any) => {
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

      return res.send(favorites)
    } catch (error: any) {
      return res.status(400).send({ error: error.message })
    }
  })

  // DELETE /favorites/:id - Remover favorito (sem MongoDB)
  app.delete('/favorites/:id', async (req: any, res: any) => {
    console.log('🗑️ DELETE favorites - cache em memória')
    
    const schema = z.object({
      id: z.string()
    })

    try {
      const { id } = schema.parse(req.params)
      
      // Procurar em todos os usuários
      let found = false
      for (const [userId, userFavorites] of favoritesCache.entries()) {
        const index = userFavorites.findIndex(f => f._id === id)
        if (index !== -1) {
          userFavorites.splice(index, 1)
          favoritesCache.set(userId, userFavorites)
          found = true
          break
        }
      }
      
      if (!found) {
        return res.status(404).send({ error: 'Favorito não encontrado' })
      }

      return res.status(204).send()
    } catch (error: any) {
      return res.status(400).send({ error: error.message })
    }
  })

  // PATCH /favorites/:id - Atualizar favorito (sem MongoDB)
  app.patch('/favorites/:id', async (req: any, res: any) => {
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
          break
        }
      }

      if (!updatedFavorite) {
        return res.status(404).send({ error: 'Favorito não encontrado' })
      }

      return res.send(updatedFavorite)
    } catch (error: any) {
      return res.status(400).send({ error: error.message })
    }
  })

  // POST /favorites/sync - Sincronizar favoritos em lote (sem MongoDB)
  app.post('/favorites/sync', async (req: any, res: any) => {
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

      return res.send({ synced: results.length, favorites: results })
    } catch (error: any) {
      return res.status(400).send({ error: error.message })
    }
  })
}