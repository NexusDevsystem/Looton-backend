// Service para rastrear atividade de usuários e enviar notificações de reengajamento
// Similar ao Duolingo - notifica quando usuário fica inativo

import { userActivityPersistence } from './persistence/user-activity-persistence.service.js';

interface UserActivity {
  userId: string;
  pushToken?: string;
  lastActiveAt: Date;
  notificationsSent: number; // contador de notificações enviadas
  lastNotificationAt?: Date;
}

class UserActivityTracker {
  private activities: Map<string, UserActivity> = new Map();
  private isLoaded = false;
  
  /**
   * Carregar dados do Redis na inicialização
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    
    console.log('[UserActivityTracker] 🔄 Carregando dados do Redis...');
    const activities = await userActivityPersistence.loadAll();
    
    for (const activity of activities) {
      this.activities.set(activity.userId, activity);
    }
    
    this.isLoaded = true;
    console.log(`[UserActivityTracker] ✅ Carregados ${activities.length} usuários do Redis`);
  }
  
  // Registrar atividade do usuário
  async recordActivity(userId: string, pushToken?: string): Promise<void> {
    // Garantir que dados estão carregados
    await this.initialize();
    
    const existing = this.activities.get(userId);
    
    const activity: UserActivity = {
      userId,
      pushToken: pushToken || existing?.pushToken,
      lastActiveAt: new Date(),
      notificationsSent: existing?.notificationsSent || 0,
      lastNotificationAt: existing?.lastNotificationAt,
    };
    
    this.activities.set(userId, activity);
    
    // Salvar no Redis (async, não aguardar)
    userActivityPersistence.save(activity).catch(err => {
      console.error('[UserActivityTracker] Erro ao salvar no Redis:', err);
    });
    
    console.log(`[UserActivity] Registrada atividade para ${userId}`);
  }
  
  // Obter usuários inativos (não usaram o app há X dias)
  async getInactiveUsers(daysInactive: number = 3): Promise<UserActivity[]> {
    // Garantir que dados estão carregados
    await this.initialize();
    
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysInactive);
    
    const inactive: UserActivity[] = [];
    
    for (const activity of this.activities.values()) {
      // Verifica se está inativo E tem push token E não enviou notificação recente
      if (
        activity.lastActiveAt < threshold &&
        activity.pushToken &&
        this.shouldSendNotification(activity)
      ) {
        inactive.push(activity);
      }
    }
    
    return inactive;
  }
  
  // Verifica se deve enviar notificação (não enviar mais que 1 por dia)
  private shouldSendNotification(activity: UserActivity): boolean {
    if (!activity.lastNotificationAt) return true;
    
    const daysSinceLastNotification = 
      (Date.now() - activity.lastNotificationAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Só enviar se passou mais de 1 dia desde a última notificação
    return daysSinceLastNotification >= 1;
  }
  
  // Marcar que notificação foi enviada
  async markNotificationSent(userId: string): Promise<void> {
    const activity = this.activities.get(userId);
    if (!activity) return;
    
    activity.notificationsSent += 1;
    activity.lastNotificationAt = new Date();
    
    // Salvar no Redis
    await userActivityPersistence.save(activity);
    
    console.log(`[UserActivity] Notificação enviada para ${userId} (total: ${activity.notificationsSent})`);
  }
  
  // Obter estatísticas
  getStats(): {
    totalUsers: number;
    activeToday: number;
    inactive3Days: number;
    inactive7Days: number;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let activeToday = 0;
    let inactive3Days = 0;
    let inactive7Days = 0;
    
    for (const activity of this.activities.values()) {
      if (activity.lastActiveAt >= today) {
        activeToday++;
      }
      if (activity.lastActiveAt < threeDaysAgo) {
        inactive3Days++;
      }
      if (activity.lastActiveAt < sevenDaysAgo) {
        inactive7Days++;
      }
    }
    
    return {
      totalUsers: this.activities.size,
      activeToday,
      inactive3Days,
      inactive7Days,
    };
  }
  
  // Obter atividade de um usuário específico
  getActivity(userId: string): UserActivity | undefined {
    return this.activities.get(userId);
  }

  
  // Obter todos os usuários (para notificação diária)
  async getAllUsers(): Promise<UserActivity[]> {
    // Garantir que dados estão carregados
    await this.initialize();
    
    return Array.from(this.activities.values());
  }
  
  // Limpar cache (útil para testes)
  async clear(): Promise<void> {
    this.activities.clear();
    await userActivityPersistence.clear();
  }
}// Singleton instance
export const userActivityTracker = new UserActivityTracker();

// Mensagens motivacionais estilo Duolingo - tom casual e amigável
export const reengagementMessages = [
  {
    title: '🎮 Eii, perdeu a vontade de jogar?',
    body: 'Tem novos jogos pra você! Ofertas incríveis chegaram 🔥',
  },
  {
    title: '💎 Opa, sumiu foi?',
    body: 'Tem jogos com desconto histórico te esperando aqui!',
  },
  {
    title: '🏆 Ei, tá fazendo o quê?',
    body: 'Seus jogos favoritos tão em promoção. Dá uma olhada! 👀',
  },
  {
    title: '🎯 Eii, volta aqui!',
    body: 'Novos jogos todo dia esperando por você. Bora conferir?',
  },
  {
    title: '⚡ Psiu, esqueceu de mim?',
    body: 'Ofertas relâmpago rolando agora. Corre que tá acabando!',
  },
  {
    title: '🔥 Ei, tá perdendo hein!',
    body: 'Os maiores descontos da semana estão aqui. Vem ver!',
  },
  {
    title: '🎁 Ô, tem presente pra você!',
    body: 'Jogos AAA com preço de banana. Sério, vem ver isso!',
  },
  {
    title: '🌟 Ei, cadê você?',
    body: 'Tá perdendo jogos com até 95% OFF. Volta logo!',
  },
];

// Obter mensagem aleatória
export function getRandomReengagementMessage(): { title: string; body: string } {
  const index = Math.floor(Math.random() * reengagementMessages.length);
  return reengagementMessages[index];
}
