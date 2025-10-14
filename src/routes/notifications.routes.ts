import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FirebaseNotificationService } from '../services/push-notifications.service.js';

// Armazenamento em memória para tokens de dispositivos (em produção, use um banco de dados)
const deviceTokens = new Map<string, { userId: string; tokens: string[]; createdAt: Date }>();

const registerDeviceTokenRoute: FastifyPluginAsync = async (fastify) => {
  // Rota para registrar token de dispositivo para notificações push
  fastify.post('/notifications/register-token', async (req, reply) => {
    const schema = z.object({
      userId: z.string(),
      token: z.string().min(1),
    });

    try {
      const { userId, token } = schema.parse(req.body);

      // Validar o token com o Firebase
      const isValidToken = await FirebaseNotificationService.validateToken(token);
      if (!isValidToken) {
        reply.status(400).send({ error: 'Token de dispositivo inválido' });
        return;
      }

      // Verificar se já existe registro para este usuário
      if (deviceTokens.has(userId)) {
        const record = deviceTokens.get(userId)!;
        // Adiciona o token se ainda não estiver registrado
        if (!record.tokens.includes(token)) {
          record.tokens.push(token);
        }
      } else {
        // Cria novo registro
        deviceTokens.set(userId, {
          userId,
          tokens: [token],
          createdAt: new Date(),
        });
      }

      console.log(`Token registrado para usuário ${userId}: ${token}`);

      reply.send({ success: true, message: 'Token registrado com sucesso' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
        return;
      }
      console.error('Erro ao registrar token:', error);
      reply.status(500).send({ error: 'Erro interno ao registrar token' });
    }
  });

  // Rota para remover token de dispositivo
  fastify.post('/notifications/remove-token', async (req, reply) => {
    const schema = z.object({
      userId: z.string(),
      token: z.string().min(1),
    });

    try {
      const { userId, token } = schema.parse(req.body);

      if (deviceTokens.has(userId)) {
        const record = deviceTokens.get(userId)!;
        const index = record.tokens.indexOf(token);
        if (index > -1) {
          record.tokens.splice(index, 1);
          
          // Se não houver mais tokens, remover o registro do usuário
          if (record.tokens.length === 0) {
            deviceTokens.delete(userId);
          }
        }
      }

      reply.send({ success: true, message: 'Token removido com sucesso' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Dados inválidos', details: error.errors });
        return;
      }
      console.error('Erro ao remover token:', error);
      reply.status(500).send({ error: 'Erro interno ao remover token' });
    }
  });

  // Rota para obter tokens de um usuário (para fins de notificação)
  fastify.get('/notifications/tokens/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };

    if (!userId) {
      reply.status(400).send({ error: 'UserId é obrigatório' });
      return;
    }

    const record = deviceTokens.get(userId);
    if (!record || record.tokens.length === 0) {
      reply.send({ tokens: [] });
      return;
    }

    // Filtrar tokens válidos
    const validTokens: string[] = [];
    for (const token of record.tokens) {
      const isValid = await FirebaseNotificationService.validateToken(token);
      if (isValid) {
        validTokens.push(token);
      } else {
        // Remover token inválido
        console.log(`Removendo token inválido: ${token}`);
      }
    }

    // Atualizar lista de tokens válidos
    if (validTokens.length !== record.tokens.length) {
      record.tokens = validTokens;
      if (validTokens.length === 0) {
        deviceTokens.delete(userId);
      }
    }

    reply.send({ tokens: validTokens });
  });
};

export default registerDeviceTokenRoute;