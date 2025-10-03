import fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './env.js'
import { registerErrorHandler } from './middlewares/errorHandler.js'
import routes from './routes/index.js'


export function buildApp() {
  const app = fastify({
    logger: env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true
  })

  app.register(cors, { origin: true })
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS
  })

  registerErrorHandler(app)

  app.get('/', async () => ({ 
    name: 'Looton Backend API',
    version: '1.0.0',
    status: 'ok',
    endpoints: ['/deals', '/health', '/pc-deals']
  }))

  app.get('/health', async () => ({ ok: true }))

  app.register(routes, { prefix: '/' })

  return app
}
