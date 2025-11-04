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
import { steamGenresRoutes } from './steam.genres.js'
import { userPreferencesRoutes } from './user.prefs.js'
import currencyRoutes from './currency.routes.js'
import feedRoutes from './feed.routes.js'
import pcRoutes from './pc.routes.js'
import priceHistoryRoutes from './price-history.routes.js'
import epicRoutes from './epic.routes.js'
import epicDetailsRoutes from './epic-details.js'
import thumbRoutes from './thumb.js'
import { testPushRoutes } from './test-push.routes.js'
import testNotificationRoutes from './test-notification.routes.js'

export default async function routes(app: FastifyInstance) {
  await app.register(dealsRoutes)
  await app.register(searchRoutes)
  await app.register(gamesRoutes)
  await app.register(alertsRoutes)
  await app.register(notificationsRoutes, { prefix: '/notifications' })
  await app.register(favoritesRoutes)
  await app.register(listsRoutes)
  await app.register(debugRoutes)
  await app.register(steamRoutes)
  await app.register(steamGenresRoutes)
  await app.register(userPreferencesRoutes)
  await app.register(currencyRoutes)
  await app.register(feedRoutes)
  await app.register(pcRoutes)
  await app.register(priceHistoryRoutes)
  await app.register(epicRoutes)
  await app.register(epicDetailsRoutes)
  await app.register(thumbRoutes)
  await app.register(testPushRoutes, { prefix: '/test' })
  await app.register(testNotificationRoutes)
}
