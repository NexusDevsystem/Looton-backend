import express, { Request, Response } from 'express';
import cors from 'cors';
import { buildApp } from './app.js';
import { env } from './env.js';
import { startJobs } from './jobs/index.js';
import { startCurationJob } from './jobs/curation.js';

async function main() {
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

  // Aplicar rate limiting se necessário
  // (Para implementar rate limiting com Express, você pode usar o express-rate-limit)

  // Registrar handlers de erro
  // (Em Express, isso é feito de forma diferente, ver abaixo)

  // Rotas
  const routes = await buildApp();
  app.use('/', routes);

  // Rota de health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true });
  });
  
  // Rota principal
  app.get('/', (req: Request, res: Response) => {
    res.json({ 
      name: 'Looton Backend API',
      version: '1.0.0',
      status: 'ok',
      endpoints: ['/deals', '/health', '/pc-deals']
    });
  });

  // Handler global de erros
  app.use((error: any, req: Request, res: Response, next: any) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  const enableJobs = process.env.ENABLE_JOBS === 'true' && env.NODE_ENV !== 'test';
  if (enableJobs) {
    try {
      await startJobs()
      startCurationJob()
      console.log('[jobs] curation jobs enabled')
    } catch (e) {
      console.error('[jobs] failed to start jobs', e)
    }
  } else {
    console.log('[jobs] disabled by ENV or NODE_ENV=test')
  }

  app.listen(env.PORT, () => {
    console.log(`Backend rodando em http://localhost:${env.PORT}`);
    console.log(`Acessível em: http://192.168.1.216:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});