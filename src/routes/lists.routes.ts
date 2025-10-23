import { FastifyInstance } from 'fastify'
import { z } from 'zod'

// Cache em memória para listas (sem MongoDB)
const listsCache = new Map<string, any[]>()
const listItemsCache = new Map<string, any[]>()

export default async function listsRoutes(app: FastifyInstance) {
  // POST /lists - Criar lista
  app.post('/lists', async (req: any, reply: any) => {
    // userId is optional: if omitted or empty the list will be public
    const schema = z.object({
      userId: z.string().optional(),
      name: z.string().min(1).max(100)
    })

    try {
      const data = schema.parse(req.body)
      
      // Gerar ID único para a lista
      const listId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      
      const listPayload: any = { 
        _id: listId,
        name: data.name,
        createdAt: new Date()
      }
      
      if (data.userId) {
        listPayload.userId = data.userId
      } else {
        // public list (no user)
        listPayload.userId = null
      }

      // Armazenar no cache
      const userLists = listsCache.get(data.userId || 'public') || []
      userLists.push(listPayload)
      listsCache.set(data.userId || 'public', userLists)

      return reply.status(201).send(listPayload)
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /lists - Listar listas do usuário
  app.get('/lists', async (req: any, reply: any) => {
    try {
      // userId optional: if provided, return user's lists + public lists. If absent, return only public lists.
      const schema = z.object({ userId: z.string().optional() })
      const { userId } = schema.parse(req.query)

      let allLists: any[] = []

      // Adicionar listas públicas
      const publicLists = listsCache.get('public') || []
      allLists = [...publicLists]

      // Se userId foi fornecido, adicionar listas do usuário
      if (userId) {
        const userLists = listsCache.get(userId) || []
        allLists = [...allLists, ...userLists]
      }

      // Contar itens de cada lista
      const listsWithCount = allLists.map(list => {
        const items = listItemsCache.get(list._id) || []
        return {
          ...list,
          itemCount: items.length
        }
      })

      return reply.send(listsWithCount)
    } catch (error: any) {
      console.error('Erro ao buscar listas:', error)
      // Fallback: retornar array vazio ao invés de erro
      return reply.send([])
    }
  })

  // POST /lists/:listId/items - Adicionar jogo à lista
  app.post('/lists/:listId/items', async (req: any, reply: any) => {
    const paramsSchema = z.object({
      listId: z.string()
    })

    const bodySchema = z.object({
      gameId: z.string(),
      notes: z.string().max(500).optional(),
      sortIndex: z.number().optional()
    })

    try {
      const { listId } = paramsSchema.parse(req.params)
      const data = bodySchema.parse(req.body)
      
      // Verificar se a lista existe
      let listExists = false
      for (const [key, lists] of listsCache.entries()) {
        if (lists.some(list => list._id === listId)) {
          listExists = true
          break
        }
      }
      
      if (!listExists) {
        return reply.status(404).send({ error: 'Lista não encontrada' })
      }

      // Gerar ID único para o item da lista
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      
      // If no sortIndex provided, use next available index
      if (data.sortIndex === undefined) {
        const items = listItemsCache.get(listId) || []
        const maxSortIndex = items.length > 0 
          ? Math.max(...items.map((item: any) => item.sortIndex || 0)) 
          : 0
        data.sortIndex = maxSortIndex + 1
      }

      const listItem = {
        _id: itemId,
        listId,
        gameId: data.gameId,
        notes: data.notes,
        sortIndex: data.sortIndex,
        createdAt: new Date()
      }

      // Armazenar item no cache
      const listItems = listItemsCache.get(listId) || []
      listItems.push(listItem)
      listItemsCache.set(listId, listItems)

      return reply.status(201).send(listItem)
    } catch (error: any) {
      // Neste ponto, listId e data podem não estar definidos no escopo do catch
      // Por isso, vamos apenas retornar o erro
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /lists/:listId/items - Listar itens da lista
  app.get('/lists/:listId/items', async (req: any, reply: any) => {
    const schema = z.object({
      listId: z.string()
    })

    const { listId } = schema.parse(req.params)
    
    const items = listItemsCache.get(listId) || []
    
    return reply.send(items)
  })

  // DELETE /lists/:listId/items/:itemId - Remover item da lista
  app.delete('/lists/:listId/items/:itemId', async (req: any, reply: any) => {
    const schema = z.object({
      listId: z.string(),
      itemId: z.string()
    })

    const { listId, itemId } = schema.parse(req.params)
    
    const items = listItemsCache.get(listId) || []
    const itemIndex = items.findIndex((item: any) => item._id === itemId)
    
    if (itemIndex === -1) {
      return reply.status(404).send({ error: 'Item não encontrado na lista' })
    }
    
    items.splice(itemIndex, 1)
    listItemsCache.set(listId, items)

    return reply.status(204).send()
  })

  // DELETE /lists/:id - Remover lista completa
  app.delete('/lists/:id', async (req: any, reply: any) => {
    const schema = z.object({
      id: z.string()
    })

    const { id } = schema.parse(req.params)
    
    // Remover todos os itens da lista
    listItemsCache.delete(id)
    
    // Remover a lista
    let listDeleted = false
    for (const [key, lists] of listsCache.entries()) {
      const listIndex = lists.findIndex((list: any) => list._id === id)
      if (listIndex !== -1) {
        lists.splice(listIndex, 1)
        listsCache.set(key, lists)
        listDeleted = true
        break
      }
    }
    
    if (!listDeleted) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    return reply.status(204).send()
  })
}