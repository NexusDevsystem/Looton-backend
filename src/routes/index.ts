import { Router, Request, Response, NextFunction } from 'express'
import dealsRoutes from './deals.routes.js'
import searchRoutes from './search.routes.js'
import gamesRoutes from './games.routes.js'
import alertsRoutes from './alerts.routes.js'
import notificationsRoutes from './notifications.routes.js'
import favoritesRoutes from './favorites.routes.js'
import listsRoutes from './lists.routes.js'
import steamRoutes from './steam.routes.js'
import { steamGenresRoutes } from './steam.genres.js'
import { userPreferencesRoutes } from './user.prefs.js'
import currencyRoutes from './currency.routes.js'
import feedRoutes from './feed.routes.js'
import pcRoutes from './pc.routes.js'
import priceHistoryRoutes from './price-history.routes.js'
import epicRoutes from './epic.routes.js'
import thumbRoutes from './thumb.js'
import hardwareRecommendationRoutes from './hardware.recommendation.js'

// Create an Express Router and adapt legacy Fastify-style route modules by providing
// a small shim object with get/post/put/delete methods that accept (path, handler).
// The handler will be called with (request, reply) where reply exposes send/status/header similar to Fastify.
function createFastifyShim(router: Router) {
  const wrapHandler = (handler: any) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Build minimal Fastify-like request
      const fReq: any = req;
      // Build reply shim
      const fReply: any = {
        send: (payload: any) => {
          if (!res.headersSent) {
            // If payload is an object, send as JSON
            return res.json(payload)
          }
          return res.end()
        },
        status: (code: number) => {
          res.status(code)
          return fReply
        },
        code: (code: number) => {
          res.status(code)
          return fReply
        },
        header: (k: string, v: any) => {
          res.setHeader(k, String(v))
          return fReply
        }
      }

      try {
        // Some handlers return values directly; if they return a value, send it
        const result = await handler(fReq, fReply)
        if (result !== undefined && !res.headersSent) {
          // If handler returned something and didn't use reply.send, send it
          res.json(result)
        }
      } catch (err) {
        next(err)
      }
    }
  }

  return {
    get: (path: string, handler: any) => router.get(path, wrapHandler(handler)),
    post: (path: string, handler: any) => router.post(path, wrapHandler(handler)),
    put: (path: string, handler: any) => router.put(path, wrapHandler(handler)),
    delete: (path: string, handler: any) => router.delete(path, wrapHandler(handler)),
    // register is a noop for nested plugins
    register: async (fn: any) => {
      // If fn is a function that expects the fastify-like instance, call it
      if (typeof fn === 'function') await fn(createFastifyShim(router) as any)
    }
  }
}

export default async function routes() {
  const router = Router()
  const shim = createFastifyShim(router)

  // call each Fastify-style route module with the shim
  await shim.register(dealsRoutes)
  await shim.register(searchRoutes)
  await shim.register(gamesRoutes)
  await shim.register(alertsRoutes)
  await shim.register(notificationsRoutes)
  await shim.register(favoritesRoutes)
  await shim.register(listsRoutes)
  await shim.register(steamRoutes)
  await shim.register(steamGenresRoutes)
  await shim.register(userPreferencesRoutes)
  await shim.register(currencyRoutes)
  await shim.register(feedRoutes)
  await shim.register(pcRoutes)
  await shim.register(priceHistoryRoutes)
  await shim.register(epicRoutes)
  await shim.register(thumbRoutes)
  await shim.register(hardwareRecommendationRoutes)

  return router
}
