import { FastifyInstance } from 'fastify'
import dealsRoutes from './deals.routes.js'
import searchRoutes from './search.routes.js'
import gamesRoutes from './games.routes.js'
import alertsRoutes from './alerts.routes.js'
import notificationsRoutes from './notifications.routes.js'
import favoritesRoutes from './favorites.routes.js'
import listsRoutes from './lists.routes.js'
import debugRoutes from './debug.routes.js'
import steamRoutes from './steam.routes.js'
import currencyRoutes from './currency.routes.js'

export default async function routes(app: FastifyInstance) {
  await app.register(dealsRoutes)
  await app.register(searchRoutes)
  await app.register(gamesRoutes)
  await app.register(alertsRoutes)
  await app.register(notificationsRoutes)
  await app.register(favoritesRoutes)
  await app.register(listsRoutes)
  await app.register(debugRoutes)
  await app.register(steamRoutes)
  await app.register(currencyRoutes)
}
