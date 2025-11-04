import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAlert, deleteAlert, getAlertsByUser, testNotify } from '../services/alerts.service.js'
import { userActivityTracker } from '../services/user-activity.service.js'

export default async function alertsRoutes(app: FastifyInstance) {
  // POST /users - Registrar usuário e push token
  app.post('/users', async (req: any, reply: any) => {
    console.log('📥 [POST /users] Recebido:', JSON.stringify(req.body, null, 2));
    
    const schema = z.object({ 
      userId: z.string(),
      email: z.string().email().optional(), 
      pushToken: z.string().optional() 
    })
    
    const body = schema.parse(req.body)
    
    console.log('✅ [POST /users] Validado:', JSON.stringify(body, null, 2));
    
    // Registrar no userActivityTracker (com persistência)
    await userActivityTracker.recordActivity(body.userId, body.pushToken)
    
    console.log('✅ [POST /users] Usuário registrado com sucesso!');
    
    return reply.code(201).send({
      success: true,
      userId: body.userId,
      message: 'Usuário registrado com sucesso'
    })
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
}
