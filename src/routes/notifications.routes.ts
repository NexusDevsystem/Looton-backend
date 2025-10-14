import { z } from 'zod'
import { NotificationRule } from '../db/models/NotificationRule.js'
import { PriceWindow } from '../db/models/PriceWindow.js'
import { evaluateAndPush } from '../services/notification.service.js'

export default async function notificationsRoutes(app: any) {
  app.post('/notification-rules', async (req: any, res: any) => {
    const schema = z.object({ userId: z.string().length(24), type: z.enum(['studio','franchise','game','store']), query: z.string().optional(), gameId: z.string().length(24).optional() })
    const body = schema.parse(req.body)
    const r = await NotificationRule.create({ userId: body.userId, type: body.type, query: body.query, gameId: body.gameId })
    return res.status(201).send(r)
  })

  app.get('/notification-rules', async (req: any, res: any) => {
    const { userId } = z.object({ userId: z.string().length(24).optional() }).parse(req.query)
    const q = userId ? { userId } : {}
    const list = await NotificationRule.find(q).lean()
    return res.send(list)
  })

  app.post('/price-windows', async (req: any, res: any) => {
    const schema = z.object({ userId: z.string().length(24), gameId: z.string().length(24).optional(), store: z.string().optional(), min: z.number().optional(), max: z.number().optional() })
    const body = schema.parse(req.body)
    const pw = await PriceWindow.create({ userId: body.userId, gameId: body.gameId, store: body.store, min: body.min, max: body.max })
    return res.status(201).send(pw)
  })

  // Admin/test endpoint to evaluate a deal and trigger pushes
  app.post('/_admin/evaluate-deal', async (req: any, res: any) => {
    const schema = z.object({ deal: z.any() })
    const { deal } = schema.parse(req.body)
    await evaluateAndPush(deal)
    return res.send({ ok: true })
  })
}
