// Job para enviar notificações de reengajamento para usuários inativos
// Estilo Duolingo - motiva usuários a voltar ao app

import { userActivityTracker, getRandomReengagementMessage } from '../services/user-activity.service.js';

export async function runReengagementJob() {
  try {
    console.log('[ReengagementJob] Iniciando verificação de usuários inativos...');
    
    // Buscar usuários inativos há 2 dias ou mais
    const inactiveUsers = await userActivityTracker.getInactiveUsers(2);
    
    if (inactiveUsers.length === 0) {
      console.log('[ReengagementJob] Nenhum usuário inativo encontrado');
      return;
    }
    
    console.log(`[ReengagementJob] Encontrados ${inactiveUsers.length} usuários inativos`);
    
    // Enviar notificações
    for (const user of inactiveUsers) {
      if (!user.pushToken) continue;
      
      const message = getRandomReengagementMessage();
      
      try {
        // Enviar via Expo Push API
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            to: user.pushToken,
            sound: 'default',
            title: message.title,
            body: message.body,
            priority: 'high',
            channelId: 'reengagement',
            data: {
              type: 'reengagement',
              experienceId: '@nyill/looton-app',
            },
            badge: 1,
            android: {
              sound: 'default',
              priority: 'max',
              vibrate: [0, 250, 250, 250],
            },
          }),
        });
        
        const result = await response.json();
        
        if (result.data?.status === 'ok' || result.data?.id) {
          console.log(`[ReengagementJob] ✅ Notificação enviada para ${user.userId}`);
          await userActivityTracker.markNotificationSent(user.userId);
        } else {
          console.warn(`[ReengagementJob] ⚠️ Falha ao enviar para ${user.userId}:`, result);
        }
      } catch (error) {
        console.error(`[ReengagementJob] ❌ Erro ao enviar para ${user.userId}:`, error);
      }
      
      // Aguardar 500ms entre envios para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const stats = userActivityTracker.getStats();
    console.log('[ReengagementJob] Estatísticas:', stats);
    
  } catch (error) {
    console.error('[ReengagementJob] Erro:', error);
  }
}

// Executar job a cada 12 horas
export function startReengagementJob() {
  console.log('[ReengagementJob] Job de reengajamento iniciado (executa a cada 12h)');
  
  // Executar imediatamente ao iniciar (para teste)
  // runReengagementJob();
  
  // Executar a cada 12 horas
  setInterval(() => {
    runReengagementJob();
  }, 12 * 60 * 60 * 1000);
}
