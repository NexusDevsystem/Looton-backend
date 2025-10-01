import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Types } from 'mongoose'
import { Favorite } from '../db/models/Favorite.js'

export default async function favoritesRoutes(app: FastifyInstance) {
  // POST /favorites - Criar favorito
  app.post('/favorites', async (req: any, reply: any) => {
    const schema = z.object({
      userId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'userId deve ser um ObjectId válido'
      }),
      gameId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'gameId deve ser um ObjectId válido'
      }),
      stores: z.array(z.string()).optional(),
      notifyUp: z.boolean().optional(),
      notifyDown: z.boolean().optional(),
      pctThreshold: z.number().min(1).max(100).optional(),
      desiredPriceCents: z.number().int().min(0).optional(),
      listId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'listId deve ser um ObjectId válido'
      }).optional()
    })

    try {
      const data = schema.parse(req.body)
      
      const favorite = new Favorite({
        userId: new Types.ObjectId(data.userId),
        gameId: new Types.ObjectId(data.gameId),
        stores: data.stores,
        notifyUp: data.notifyUp,
        notifyDown: data.notifyDown,
        pctThreshold: data.pctThreshold,
        desiredPriceCents: data.desiredPriceCents,
        listId: data.listId ? new Types.ObjectId(data.listId) : undefined
      })

      await favorite.save()
      return reply.status(201).send(favorite)
    } catch (error: any) {
      if (error.code === 11000) {
        return reply.status(409).send({ error: 'Jogo já está nos favoritos' })
      }
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /favorites - Listar favoritos
  app.get('/favorites', async (req: any, reply: any) => {
    const schema = z.object({
      userId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'userId deve ser um ObjectId válido'
      }),
      store: z.enum(['steam', 'epic']).optional(),
      changed: z.enum(['down', 'up']).optional()
    })

    const { userId, store, changed } = schema.parse(req.query)
    
    let filter: any = { userId: new Types.ObjectId(userId) }
    
    if (store) {
      filter.stores = store
    }

    const favorites = await Favorite.find(filter)
      .populate('gameId')
      .sort({ createdAt: -1 })

    return reply.send(favorites)
  })

  // DELETE /favorites/:id - Remover favorito
  app.delete('/favorites/:id', async (req: any, reply: any) => {
    const schema = z.object({
      id: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'id deve ser um ObjectId válido'
      })
    })

    const { id } = schema.parse(req.params)
    
    const favorite = await Favorite.findByIdAndDelete(id)
    
    if (!favorite) {
      return reply.status(404).send({ error: 'Favorito não encontrado' })
    }

    return reply.status(204).send()
  })

  // PATCH /favorites/:id - Atualizar favorito
  app.patch('/favorites/:id', async (req: any, reply: any) => {
    const schema = z.object({
      id: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'id deve ser um ObjectId válido'
      })
    })

    const bodySchema = z.object({
      stores: z.array(z.string()).optional(),
      notifyUp: z.boolean().optional(),
      notifyDown: z.boolean().optional(),
      pctThreshold: z.number().min(1).max(100).optional(),
      desiredPriceCents: z.number().int().min(0).optional(),
      listId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'listId deve ser um ObjectId válido'
      }).optional()
    })

    try {
      const { id } = schema.parse(req.params)
      const data = bodySchema.parse(req.body)

      const update: any = {}
      if (data.stores !== undefined) update.stores = data.stores
      if (data.notifyUp !== undefined) update.notifyUp = data.notifyUp
      if (data.notifyDown !== undefined) update.notifyDown = data.notifyDown
      if (data.pctThreshold !== undefined) update.pctThreshold = data.pctThreshold
      if (data.desiredPriceCents !== undefined) update.desiredPriceCents = data.desiredPriceCents
      if (data.listId !== undefined) update.listId = new Types.ObjectId(data.listId)

      const favorite = await Favorite.findByIdAndUpdate(id, update, { new: true })

      if (!favorite) return reply.status(404).send({ error: 'Favorito não encontrado' })

      return reply.send(favorite)
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // POST /favorites/sync - Sincronizar favoritos em lote (mobile -> server)
  // Body: { userId, favorites: [{ gameId, stores?, notifyUp?, notifyDown?, pctThreshold?, desiredPriceCents?, listId? }] }
  app.post('/favorites/sync', async (req: any, reply: any) => {
    const schema = z.object({
      userId: z.string().refine(val => Types.ObjectId.isValid(val), {
        message: 'userId deve ser um ObjectId válido'
      }),
      favorites: z.array(z.object({
        gameId: z.string().refine(val => Types.ObjectId.isValid(val), {
          message: 'gameId deve ser um ObjectId válido'
        }),
        stores: z.array(z.string()).optional(),
        notifyUp: z.boolean().optional(),
        notifyDown: z.boolean().optional(),
        pctThreshold: z.number().min(1).max(100).optional(),
        desiredPriceCents: z.number().int().min(0).optional(),
        listId: z.string().refine(val => Types.ObjectId.isValid(val), {
          message: 'listId deve ser um ObjectId válido'
        }).optional()
      }))
    })

    try {
      const data = schema.parse(req.body)
      const userObjectId = new Types.ObjectId(data.userId)

      const results: any[] = []

      for (const f of data.favorites) {
        const gameObjectId = new Types.ObjectId(f.gameId)

        // Upsert: if favorite exists for this user+game, update fields; otherwise create
        const update: any = {
          userId: userObjectId,
          gameId: gameObjectId
        }

        if (f.stores !== undefined) update.stores = f.stores
        if (f.notifyUp !== undefined) update.notifyUp = f.notifyUp
        if (f.notifyDown !== undefined) update.notifyDown = f.notifyDown
        if (f.pctThreshold !== undefined) update.pctThreshold = f.pctThreshold
        if (f.desiredPriceCents !== undefined) update.desiredPriceCents = f.desiredPriceCents
        if (f.listId !== undefined) update.listId = new Types.ObjectId(f.listId)

        const fav = await Favorite.findOneAndUpdate(
          { userId: userObjectId, gameId: gameObjectId },
          { $set: update },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        results.push(fav)
      }

      return reply.send({ synced: results.length, favorites: results })
    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })
}