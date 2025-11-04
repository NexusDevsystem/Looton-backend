import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { userActivityTracker } from '../services/user-activity.service.js';
import cron from 'node-cron';

const expo = new Expo();

/**
 * Job de teste - Envia notificação agendada para 14:05
 * TEMPORÁRIO - Apenas para teste
 */
export function scheduleTestNotification() {
  // Agendar para 14:05 (horário de Brasília)
  const task = cron.schedule(
    '5 14 * * *', // 14:05 todos os dias
    async () => {
      console.log('🔔 [TEST SCHEDULED] Enviando notificação de teste agendada para 14:05...');
      
      try {
        const activeUsers = await userActivityTracker.getAllUsers();
        console.log(`📊 [TEST SCHEDULED] Usuários ativos: ${activeUsers.length}`);
        
        if (activeUsers.length === 0) {
          console.log('⚠️ [TEST SCHEDULED] Nenhum usuário ativo com push token');
          return;
        }

        const messages: ExpoPushMessage[] = [];
        
        for (const user of activeUsers) {
          if (!Expo.isExpoPushToken(user.pushToken)) {
            console.warn(`⚠️ [TEST SCHEDULED] Token inválido para usuário ${user.userId}`);
            continue;
          }

          messages.push({
            to: user.pushToken,
            sound: 'default',
            title: '🔔 Notificação de Teste Agendada',
            body: `Teste enviado às 14:05! Usuário: ${user.userId}`,
            data: {
              type: 'test_scheduled',
              userId: user.userId,
              timestamp: new Date().toISOString(),
            },
            priority: 'high',
            channelId: 'default',
          });
        }

        if (messages.length === 0) {
          console.log('⚠️ [TEST SCHEDULED] Nenhuma mensagem válida para enviar');
          return;
        }

        console.log(`📤 [TEST SCHEDULED] Enviando ${messages.length} notificações...`);
        
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            console.log(`✅ [TEST SCHEDULED] Chunk enviado: ${ticketChunk.length} tickets`);
          } catch (error) {
            console.error('❌ [TEST SCHEDULED] Erro ao enviar chunk:', error);
          }
        }

        console.log(`✅ [TEST SCHEDULED] Notificação de teste enviada com sucesso!`);
        console.log(`📊 [TEST SCHEDULED] Total de tickets: ${tickets.length}`);
        
        // Mostrar detalhes dos tickets
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            console.error(`❌ [TEST SCHEDULED] Ticket ${index} erro:`, ticket.message);
          } else {
            console.log(`✅ [TEST SCHEDULED] Ticket ${index} OK:`, ticket.id);
          }
        });

      } catch (error) {
        console.error('❌ [TEST SCHEDULED] Erro ao enviar notificação de teste:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    }
  );

  console.log('⏰ [TEST SCHEDULED] Job agendado para 14:05 (horário de Brasília)');
  return task;
}
