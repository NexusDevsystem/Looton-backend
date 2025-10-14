import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import routes from './routes/index.js';

export function buildApp() {
  const app = express();

  // Middleware para parsing de JSON
  app.use(express.json());

  // Configuração de CORS
  app.use(cors({
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
  }));

  // Middleware de rate limiting
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX
  });
  app.use(limiter);

  // Aplicar as rotas
  app.use('/', routes);

  // Rota principal
  app.get('/', (req: Request, res: Response) => {
    res.json({ 
      name: 'Looton Backend API',
      version: '1.0.0',
      status: 'ok',
      endpoints: ['/deals', '/health', '/pc-deals']
    });
  });

  // Rota de health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}