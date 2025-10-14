import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAlert, deleteAlert, getAlertsByUser, registerUser, testNotify, checkAndNotify } from '../services/alerts.service.js'

export default async function alertsRoutes(app: FastifyInstance) {
  app.post('/users', async (req: any, reply: any) => {
    const schema = z.object({ email: z.string().email(), pushToken: z.string().optional() })
    const body = schema.parse(req.body)
    const user = await registerUser(body)
    return reply.code(201).send(user)
  })

  app.post('/alerts', async (req: any, reply: any) => {
    const schema = z.object({
      userId: z.string().length(24),
      query: z.string().optional(),
      gameId: z.string().length(24).optional(),
      maxPrice: z.number(),
      stores: z.array(z.string().min(1)),
      isActive: z.boolean().optional()
  }).refine((d: any) => Boolean(d.query) !== Boolean(d.gameId), {
      message: 'Provide either query or gameId (XOR)'
    })
    const body = schema.parse(req.body)
    const alert = await createAlert(body)
    return reply.code(201).send(alert)
  })

  app.get('/alerts', async (req: any, reply: any) => {
    const schema = z.object({ userId: z.string().length(24) })
    const { userId } = schema.parse(req.query)
    const list = await getAlertsByUser(userId)
    return reply.send(list)
  })

  app.delete('/alerts/:id', async (req: any, reply: any) => {
    const schema = z.object({ id: z.string().length(24) })
    const { id } = schema.parse(req.params)
    await deleteAlert(id)
    return reply.code(204).send()
  })

  app.post('/notify/test', async (req: any, reply: any) => {
    const schema = z.object({ token: z.string(), title: z.string().default('Looton'), body: z.string() })
    const body = schema.parse(req.body)
    const ok = await testNotify(body)
    return reply.send({ ok })
  })
  
  // Nova rota para testar notificação baseada em oferta
  app.post('/notify/deal-test', async (req: any, reply: any) => {
    const schema = z.object({ 
      userId: z.string().length(24),
      title: z.string().default('Jogo Teste'),
      price: z.number(),
      store: z.string().default('Steam'),
      discount: z.number().default(50)
    })
    const body = schema.parse(req.body)
    
    // Simular uma oferta para testar o sistema de notificação
    const mockOffer = {
      priceFinal: body.price,
      discountPct: body.discount,
      storeId: new (await import('mongoose')).Types.ObjectId() // Mock ID
    }
    
    try {
      await checkAndNotify(body.userId, mockOffer as any)
      return reply.send({ ok: true, message: 'Notificação de teste enviada' })
    } catch (error) {
      console.error('Erro no teste de notificação:', error)
      return reply.status(500).send({ ok: false, error: 'Erro ao enviar notificação de teste' })
    }
  })
}
