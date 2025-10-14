import { FastifyPluginAsync } from 'fastify'
import dealsRoutes from './deals.routes.js'
import searchRoutes from './search.routes.js'
import gamesRoutes from './games.routes.js'
import alertsRoutes from './alerts.routes.js'
import notificationsRoutes from './notifications.routes.js'
import favoritesRoutes from './favorites.routes.js'
import listsRoutes from './lists.routes.js'
import steamRoutes from './steam.routes.js'
import { steamGenresRoutes } from './steam.genres.js'
import userPreferencesRoutes from './user.prefs.js'
import currencyRoutes from './currency.routes.js'
import feedRoutes from './feed.routes.js'
import pcRoutes from './pc.routes.js'
import priceHistoryRoutes from './price-history.routes.js'
import epicRoutes from './epic.routes.js'
import thumbRoutes from './thumb.js'
import hardwareRecommendationRoutes from './hardware.recommendation.js'
import analyticsRoutes from './analytics.routes.js'

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(dealsRoutes)
  fastify.register(searchRoutes)
  fastify.register(gamesRoutes)
  fastify.register(alertsRoutes)
  fastify.register(notificationsRoutes)
  fastify.register(favoritesRoutes)
  fastify.register(listsRoutes)
  fastify.register(steamRoutes)
  fastify.register(steamGenresRoutes)
  fastify.register(userPreferencesRoutes)
  fastify.register(currencyRoutes)
  fastify.register(feedRoutes)
  fastify.register(pcRoutes)
  fastify.register(priceHistoryRoutes)
  fastify.register(epicRoutes)
  fastify.register(thumbRoutes)
  fastify.register(hardwareRecommendationRoutes)
  fastify.register(analyticsRoutes)
}

export default routes
