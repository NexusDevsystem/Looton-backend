import fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { registerErrorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

export async function buildApp() {
  const app = fastify({
    logger: env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true
  });

  app.register(cors, {
    origin: [
      // Permitir todas as origens para desenvolvimento e produção
      // Em produção, substitua por domínios específicos se necessário
      /.*\.expo\.dev$/,  // Permitir URLs do Expo
      /.*\.expo\.app$/,  // Permitir URLs do Expo
      'https://u.expo.dev',  // Serviços do Expo
      'exp://',  // Protocolo do Expo Go
      'https://looton-api-placeholder-url.com', // URL placeholder para APK
      // URL real do seu backend no Render
      'https://looton-backend.onrender.com',
      'https://www.looton-backend.onrender.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
  });

  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS
  });

  registerErrorHandler(app);

  app.get('/', async (req, reply) => {
    reply.send({
      name: 'Looton Backend API',
      version: '1.0.0',
      status: 'ok',
      endpoints: ['/deals', '/health', '/pc-deals']
    });
  });

  app.get('/health', async (req, reply) => {
    reply.send({ ok: true });
  });

  app.register(routes, { prefix: '/' });

  return app;
}