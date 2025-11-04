import { FastifyInstance } from 'fastify';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { userActivityTracker } from '../services/user-activity.service.js';

const expo = new Expo();

export async function testPushRoutes(app: FastifyInstance) {
  
  // Endpoint para enviar notificação IMEDIATAMENTE
  app.get('/test/push-now', async (request, reply) => {
    console.log('🧪 [TEST PUSH NOW] Enviando notificação AGORA...');
    
    try {
      const allUsers = userActivityTracker.getAllUsers();
      console.log(`📊 [TEST PUSH NOW] Total de usuários: ${allUsers.length}`);
      
      if (allUsers.length === 0) {
        return reply.status(400).send({
          error: 'Nenhum usuário registrado',
          message: 'Abra o app Looton no celular para registrar o push token',
          users: allUsers,
        });
      }

      const messages: ExpoPushMessage[] = [];
      
      for (const user of allUsers) {
        console.log(`👤 [TEST PUSH NOW] Usuário: ${user.userId}, Token: ${user.pushToken?.substring(0, 20)}...`);
        
        if (!Expo.isExpoPushToken(user.pushToken)) {
          console.warn(`⚠️ [TEST PUSH NOW] Token inválido para ${user.userId}`);
          continue;
        }

        messages.push({
          to: user.pushToken,
          sound: 'default',
          title: '🎮 Teste de Notificação AGORA',
          body: `Funcionou! Enviado em ${new Date().toLocaleTimeString('pt-BR')}`,
          data: {
            type: 'test_immediate',
            userId: user.userId,
            timestamp: new Date().toISOString(),
          },
          priority: 'high',
          channelId: 'default',
        });
      }

      if (messages.length === 0) {
        return reply.status(400).send({
          error: 'Nenhum token válido',
          users: allUsers,
        });
      }

      console.log(`📤 [TEST PUSH NOW] Enviando ${messages.length} notificações...`);
      
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log(`✅ [TEST PUSH NOW] Chunk enviado: ${ticketChunk.length} tickets`);
        } catch (error) {
          console.error('❌ [TEST PUSH NOW] Erro ao enviar chunk:', error);
        }
      }

      const results = tickets.map((ticket, index) => ({
        index,
        status: ticket.status,
        id: ticket.status === 'ok' ? ticket.id : undefined,
        error: ticket.status === 'error' ? ticket.message : undefined,
      }));

      console.log(`✅ [TEST PUSH NOW] Concluído! ${tickets.length} tickets gerados`);

      return reply.send({
        success: true,
        message: 'Notificação enviada!',
        sentTo: messages.length,
        users: allUsers.map(u => ({
          userId: u.userId,
          hasToken: !!u.pushToken,
          tokenPreview: u.pushToken?.substring(0, 30) + '...',
        })),
        results,
      });

    } catch (error) {
      console.error('❌ [TEST PUSH NOW] Erro:', error);
      return reply.status(500).send({
        error: 'Erro ao enviar notificação',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Endpoint para registrar push token manualmente (para teste)
  app.post('/test/register-token', async (request, reply) => {
    const body = request.body as { userId?: string; pushToken: string };
    
    if (!body.pushToken) {
      return reply.status(400).send({
        error: 'pushToken é obrigatório',
      });
    }

    const userId = body.userId || 'test-user-' + Date.now();
    userActivityTracker.recordActivity(userId, body.pushToken);
    console.log(`✅ [TEST REGISTER] Token registrado: ${userId} - ${body.pushToken}`);

    return reply.send({
      success: true,
      message: 'Token registrado com sucesso! Agora acesse GET /test/push-now para enviar notificação',
      userId: userId,
    });
  });

  // Endpoint para enviar notificação com token específico (BYPASS do tracker)
  app.post('/test/send-to-token', async (request, reply) => {
    const body = request.body as { pushToken: string; title?: string; body?: string };
    
    if (!body.pushToken) {
      return reply.status(400).send({
        error: 'pushToken é obrigatório',
      });
    }

    try {
      if (!Expo.isExpoPushToken(body.pushToken)) {
        return reply.status(400).send({
          error: 'Token inválido',
          providedToken: body.pushToken,
        });
      }

      const message: ExpoPushMessage = {
        to: body.pushToken,
        sound: 'default',
        title: body.title || '🎮 Teste Direto de Notificação',
        body: body.body || `Enviado em ${new Date().toLocaleTimeString('pt-BR')}`,
        data: {
          type: 'test_direct',
          timestamp: new Date().toISOString(),
        },
        priority: 'high',
        channelId: 'default',
      };

      console.log(`📤 [TEST DIRECT] Enviando para token: ${body.pushToken.substring(0, 30)}...`);
      
      const tickets = await expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      console.log(`✅ [TEST DIRECT] Resposta:`, ticket);

      return reply.send({
        success: true,
        message: 'Notificação enviada!',
        ticket,
      });

    } catch (error) {
      console.error('❌ [TEST DIRECT] Erro:', error);
      return reply.status(500).send({
        error: 'Erro ao enviar notificação',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
