import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service.js';

const analyticsRoute: FastifyPluginAsync = async (fastify) => {
  // Rota para eventos do analytics (enviados pelo app Android)
  fastify.post('/analytics/event', async (req, reply) => {
    const schema = z.object({
      userId: z.string().optional(), // Pode ser anonimo
      eventType: z.string(), // 'screen_view', 'game_search', 'deal_tap', etc
      properties: z.record(z.unknown()).optional(), // Dados adicionais do evento
      timestamp: z.number().optional(), // Timestamp do evento
    });

    try {
      const eventData = schema.parse(req.body);

      // Registra o evento no analytics
      await analyticsService.logEvent({
        userId: eventData.userId || 'anonymous',
        eventType: eventData.eventType,
        properties: eventData.properties || {},
        timestamp: eventData.timestamp || Date.now(),
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip,
        path: req.url
      });

      reply.send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
        return;
      }
      console.error('Erro ao registrar evento de analytics:', error);
      reply.status(500).send({ error: 'Erro interno ao registrar evento' });
    }
  });

  // Rota para obter métricas (requer autenticação para proteger dados)
  fastify.get('/analytics/metrics', async (req, reply) => {
    const authHeader = req.headers.authorization;
    
    // Validação simples - em produção, use JWT ou outro mecanismo seguro
    if (authHeader !== `Bearer ${process.env.ANALYTICS_API_KEY}`) {
      reply.status(401).send({ error: 'Acesso não autorizado' });
      return;
    }

    try {
      const metrics = await analyticsService.getMetrics();
      reply.send(metrics);
    } catch (error) {
      console.error('Erro ao obter métricas de analytics:', error);
      reply.status(500).send({ error: 'Erro interno ao obter métricas' });
    }
  });

  // Rota para obter dados de usuários ativos
  fastify.get('/analytics/users', async (req, reply) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader !== `Bearer ${process.env.ANALYTICS_API_KEY}`) {
      reply.status(401).send({ error: 'Acesso não autorizado' });
      return;
    }

    try {
      const usersData = await analyticsService.getUsersData();
      reply.send(usersData);
    } catch (error) {
      console.error('Erro ao obter dados de usuários:', error);
      reply.status(500).send({ error: 'Erro interno ao obter dados de usuários' });
    }
  });
};

export default analyticsRoute;