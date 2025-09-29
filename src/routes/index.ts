import { FastifyInstance } from 'fastify'
import dealsRoutes from './deals.routes.js'
import searchRoutes from './search.routes.js'
import gamesRoutes from './games.routes.js'
import alertsRoutes from './alerts.routes.js'

export default async function routes(app: FastifyInstance) {
  await app.register(dealsRoutes)
  await app.register(searchRoutes)
  await app.register(gamesRoutes)
  await app.register(alertsRoutes)
}
