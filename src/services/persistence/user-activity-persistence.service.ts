/**
 * Serviço de persistência para User Activity usando Redis
 * Garante que dados de usuários não sejam perdidos ao reiniciar o servidor
 */

import { getRedis } from '../../lib/redis.js';

interface UserActivity {
  userId: string;
  pushToken?: string;
  lastActiveAt: Date;
  notificationsSent: number;
  lastNotificationAt?: Date;
}

const REDIS_PREFIX = 'user_activity:';
const REDIS_LIST_KEY = 'user_activity:list';

export class UserActivityPersistence {
  /**
   * Salvar atividade de um usuário no Redis
   */
  async save(activity: UserActivity): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${activity.userId}`;
      
      const data = JSON.stringify({
        userId: activity.userId,
        pushToken: activity.pushToken,
        lastActiveAt: activity.lastActiveAt.toISOString(),
        notificationsSent: activity.notificationsSent,
        lastNotificationAt: activity.lastNotificationAt?.toISOString(),
      });
      
      // Salvar com TTL de 90 dias (usuários inativos serão removidos automaticamente)
      await redis.setex(key, 90 * 24 * 60 * 60, data);
      
      console.log(`[UserActivityPersistence] ✅ Saved: ${activity.userId}`);
    } catch (error) {
      console.error('[UserActivityPersistence] ❌ Error saving:', error);
    }
  }

  /**
   * Carregar atividade de um usuário do Redis
   */
  async load(userId: string): Promise<UserActivity | null> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return {
        userId: parsed.userId,
        pushToken: parsed.pushToken,
        lastActiveAt: new Date(parsed.lastActiveAt),
        notificationsSent: parsed.notificationsSent,
        lastNotificationAt: parsed.lastNotificationAt ? new Date(parsed.lastNotificationAt) : undefined,
      };
    } catch (error) {
      console.error('[UserActivityPersistence] ❌ Error loading:', error);
      return null;
    }
  }

  /**
   * Carregar todas as atividades do Redis
   */
  async loadAll(): Promise<UserActivity[]> {
    try {
      const redis = getRedis();
      const activities: UserActivity[] = [];
      
      // Escanear todas as chaves com o prefixo
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${REDIS_PREFIX}*`, 'COUNT', 100);
        cursor = nextCursor;
        
        // Carregar dados de cada chave
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              activities.push({
                userId: parsed.userId,
                pushToken: parsed.pushToken,
                lastActiveAt: new Date(parsed.lastActiveAt),
                notificationsSent: parsed.notificationsSent,
                lastNotificationAt: parsed.lastNotificationAt ? new Date(parsed.lastNotificationAt) : undefined,
              });
            } catch (parseError) {
              console.error('[UserActivityPersistence] Error parsing activity:', parseError);
            }
          }
        }
      } while (cursor !== '0');
      
      console.log(`[UserActivityPersistence] ✅ Loaded ${activities.length} activities from Redis`);
      return activities;
    } catch (error) {
      console.error('[UserActivityPersistence] ❌ Error loading all:', error);
      return [];
    }
  }

  /**
   * Deletar atividade de um usuário
   */
  async delete(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}`;
      await redis.del(key);
      console.log(`[UserActivityPersistence] 🗑️ Deleted: ${userId}`);
    } catch (error) {
      console.error('[UserActivityPersistence] ❌ Error deleting:', error);
    }
  }

  /**
   * Limpar todas as atividades (usar com cuidado)
   */
  async clear(): Promise<void> {
    try {
      const redis = getRedis();
      let cursor = '0';
      let deletedCount = 0;
      
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${REDIS_PREFIX}*`, 'COUNT', 100);
        cursor = nextCursor;
        
        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');
      
      console.log(`[UserActivityPersistence] 🧹 Cleared ${deletedCount} activities`);
    } catch (error) {
      console.error('[UserActivityPersistence] ❌ Error clearing:', error);
    }
  }
}

// Singleton instance
export const userActivityPersistence = new UserActivityPersistence();
