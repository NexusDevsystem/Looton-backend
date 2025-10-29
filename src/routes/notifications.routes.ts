import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { evaluateAndPush } from '../services/notification.service.js'
import { sendPushNotification } from '../services/firebase.service.js'

// Caches em memória para as regras de notificação e janelas de preço (sem MongoDB)
const notificationRulesCache = new Map<string, any[]>()
const priceWindowsCache = new Map<string, any[]>()

export default async function notificationsRoutes(app: FastifyInstance) {
  app.post('/notification-rules', async (req: any, reply: any) => {
    const schema = z.object({ 
      userId: z.string(), 
      type: z.enum(['studio','franchise','game','store']), 
      query: z.string().optional(), 
      gameId: z.string().optional() 
    })
    const body = schema.parse(req.body)
    
    // Gerar ID único para a regra
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    const rule = {
      _id: ruleId,
      userId: body.userId,
      type: body.type,
      query: body.query,
      gameId: body.gameId,
      createdAt: new Date()
    }
    
    // Armazenar no cache
    const userRules = notificationRulesCache.get(body.userId) || []
    userRules.push(rule)
    notificationRulesCache.set(body.userId, userRules)
    
    return reply.code(201).send(rule)
  })

  app.get('/notification-rules', async (req: any, reply: any) => {
    const { userId } = z.object({ userId: z.string().optional() }).parse(req.query)
    
    let rules: any[] = []
    if (userId) {
      rules = notificationRulesCache.get(userId) || []
    } else {
      // Retornar todas as regras de todos os usuários (não recomendado em produção real)
      for (const [, userRules] of notificationRulesCache.entries()) {
        rules = [...rules, ...userRules]
      }
    }
    
    return reply.send(rules)
  })

  app.post('/price-windows', async (req: any, reply: any) => {
    const schema = z.object({ 
      userId: z.string(), 
      gameId: z.string().optional(), 
      store: z.string().optional(), 
      min: z.number().optional(), 
      max: z.number().optional() 
    })
    const body = schema.parse(req.body)
    
    // Gerar ID único para a janela de preço
    const windowId = `window_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    const priceWindow = {
      _id: windowId,
      userId: body.userId,
      gameId: body.gameId,
      store: body.store,
      min: body.min,
      max: body.max,
      createdAt: new Date()
    }
    
    // Armazenar no cache
    const userWindows = priceWindowsCache.get(body.userId) || []
    userWindows.push(priceWindow)
    priceWindowsCache.set(body.userId, userWindows)
    
    return reply.code(201).send(priceWindow)
  })

  // Admin/test endpoint to evaluate a deal and trigger pushes
  app.post('/_admin/evaluate-deal', async (req: any, reply: any) => {
    const schema = z.object({ deal: z.any() })
    const { deal } = schema.parse(req.body)
    await evaluateAndPush(deal)
    return reply.send({ ok: true })
  })

  // Endpoint para enviar notificação de confirmação via Firebase FCM
  app.post('/send-confirmation', async (req: any, reply: any) => {
    const schema = z.object({
      pushToken: z.string(),
      title: z.string(),
      body: z.string(),
    })
    
    const { pushToken, title, body } = schema.parse(req.body)
    
    try {
      const result = await sendPushNotification(pushToken, title, body, { type: 'confirmation' })
      console.log('✅ Notificação push de confirmação enviada:', pushToken)
      return reply.send({ success: true, result })
    } catch (error) {
      console.error('❌ Erro ao enviar notificação push:', error)
      return reply.code(500).send({ success: false, error: String(error) })
    }
  })
}