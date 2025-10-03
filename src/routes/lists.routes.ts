import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { List } from '../db/models/List.js'
import { ListItem } from '../db/models/ListItem.js'

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
      
      const listPayload: any = { name: data.name }
      if (data.userId && Types.ObjectId.isValid(data.userId)) {
        listPayload.userId = new Types.ObjectId(data.userId)
      } else {
        // public list (no user)
        listPayload.userId = null
      }

      const list = new List(listPayload)

      await list.save()
      return reply.status(201).send(list)
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.status(409).send({ error: 'Já existe uma lista com este nome' })
      }
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /lists - Listar listas do usuário
  app.get('/lists', async (req: any, reply: any) => {
    try {
      // userId optional: if provided, return user's lists + public lists. If absent, return only public lists.
      const schema = z.object({ userId: z.string().optional() })
      const { userId } = schema.parse(req.query)

      let query: any = { userId: null }
      if (userId && Types.ObjectId.isValid(userId)) {
        // user's own lists + public lists
        query = { $or: [{ userId: new Types.ObjectId(userId) }, { userId: null }] }
      }

      // Adicionar timeout maior e fallback
      const lists = await List.find(query)
        .sort({ createdAt: -1 })
        .maxTimeMS(5000)
        .lean() // Use lean para melhor performance

      // Se não conseguir buscar listas, retornar array vazio ao invés de erro
      if (!lists) {
        console.warn('MongoDB timeout - retornando lista vazia')
        return reply.send([])
      }

      // Get item count para cada lista com timeout
      const listsWithCount = await Promise.all(
        lists.map(async (list) => {
          try {
            const itemCount = await ListItem.countDocuments({ listId: list._id })
              .maxTimeMS(2000)
            return {
              ...list,
              itemCount
            }
          } catch (error) {
            console.warn(`Erro ao contar items da lista ${list._id}:`, error)
            return {
              ...list,
              itemCount: 0 // Fallback
            }
          }
        })
      )

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
      listId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'listId deve ser um ObjectId válido'
      })
    })

    const bodySchema = z.object({
      gameId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'gameId deve ser um ObjectId válido'
      }),
      notes: z.string().max(500).optional(),
      sortIndex: z.number().optional()
    })

    try {
      const { listId } = paramsSchema.parse(req.params)
      const data = bodySchema.parse(req.body)
      
      // Verify list exists
      const list = await List.findById(listId)
      if (!list) {
        return reply.status(404).send({ error: 'Lista não encontrada' })
      }

      // If no sortIndex provided, use next available index
      if (data.sortIndex === undefined) {
        const maxSortIndex = await ListItem.findOne({ listId: new Types.ObjectId(listId) })
          .sort({ sortIndex: -1 })
          .select('sortIndex')
        data.sortIndex = (maxSortIndex?.sortIndex || 0) + 1
      }

      const listItem = new ListItem({
        listId: new Types.ObjectId(listId),
        gameId: new Types.ObjectId(data.gameId),
        notes: data.notes,
        sortIndex: data.sortIndex
      })

      await listItem.save()
      await listItem.populate('gameId')
      
      return reply.status(201).send(listItem)
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.status(409).send({ error: 'Jogo já está nesta lista' })
      }
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /lists/:listId/items - Listar itens da lista
  app.get('/lists/:listId/items', async (req: any, reply: any) => {
    const schema = z.object({
      listId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'listId deve ser um ObjectId válido'
      })
    })

    const { listId } = schema.parse(req.params)
    
    const items = await ListItem.find({ listId: new Types.ObjectId(listId) })
      .populate('gameId')
      .sort({ sortIndex: 1, createdAt: 1 })

    return reply.send(items)
  })

  // DELETE /lists/:listId/items/:itemId - Remover item da lista
  app.delete('/lists/:listId/items/:itemId', async (req: any, reply: any) => {
    const schema = z.object({
      listId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'listId deve ser um ObjectId válido'
      }),
      itemId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'itemId deve ser um ObjectId válido'
      })
    })

    const { listId, itemId } = schema.parse(req.params)
    
    const item = await ListItem.findOneAndDelete({
      _id: new Types.ObjectId(itemId),
      listId: new Types.ObjectId(listId)
    })
    
    if (!item) {
      return reply.status(404).send({ error: 'Item não encontrado na lista' })
    }

    return reply.status(204).send()
  })

  // DELETE /lists/:id - Remover lista completa
  app.delete('/lists/:id', async (req: any, reply: any) => {
    const schema = z.object({
      id: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'id deve ser um ObjectId válido'
      })
    })

    const { id } = schema.parse(req.params)
    
    // Remove all list items first
    await ListItem.deleteMany({ listId: new Types.ObjectId(id) })
    
    // Remove the list
    const list = await List.findByIdAndDelete(id)
    
    if (!list) {
      return reply.status(404).send({ error: 'Lista não encontrada' })
    }

    return reply.status(204).send()
  })
}