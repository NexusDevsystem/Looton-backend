import { FastifyInstance } from 'fastify'
import { TB_HARDWARE_COMPONENTS } from '../services/terabyte.hardware'

export default async function pcDealsRoutes(app: FastifyInstance) {
  app.get('/pc-deals', async (request, reply) => {
    try {
      const q = (request.query as any)?.q || ''
      const limit = parseInt((request.query as any)?.limit || '30', 10)
      const offset = parseInt((request.query as any)?.offset || '0', 10)

      // Simple text filter on name/brand/specs
      const filtered = TB_HARDWARE_COMPONENTS.filter(c => {
        if (!q) return true
        const s = q.toLowerCase()
        return (c.name || '').toLowerCase().includes(s) || (c.brand || '').toLowerCase().includes(s) || (c.specs || '').toLowerCase().includes(s)
      })

      const slice = filtered.slice(offset, offset + limit)

      // Map to PcOffer expected shape
      const items = slice.map(c => ({
        store: c.store || 'TerabyteShop',
        title: c.name,
        url: c.url,
        image: c.imageUrl,
        category: c.category,
        priceFinalCents: Math.round((c.price || 0) * 100),
        priceBaseCents: c.originalPrice ? Math.round(c.originalPrice * 100) : undefined,
        discountPct: c.discountPct,
        availability: 'in_stock',
        sku: c.id,
        ean: undefined,
        updatedAt: new Date().toISOString()
      }))

      return reply.send({ slotDate: new Date().toISOString().split('T')[0], items })
    } catch (err) {
      console.error('Erro em /pc-deals:', err)
      return reply.status(500).send({ error: 'Erro interno' })
    }
  })
}
