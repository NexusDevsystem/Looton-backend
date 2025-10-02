import { FastifyInstance } from 'fastify'
import { getCurrentFeed } from '../services/curate.js'

export default async function feedRoutes(app: FastifyInstance) {
  app.get('/feed/curated', async (_req, reply) => {
    const feed = getCurrentFeed()
    return reply.send(feed)
  })
}