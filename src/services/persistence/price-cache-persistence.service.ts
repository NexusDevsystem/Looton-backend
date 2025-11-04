/**
 * Serviço de persistência para Cache de Preços usando Redis
 * Usado pelo Watched Games Job para detectar mudanças de preço
 */

import { getRedis } from '../../lib/redis.js';

interface PriceCache {
  price: number;
  discount: number;
  lastUpdated?: Date;
}

const REDIS_PREFIX = 'price_cache:';

export class PriceCachePersistence {
  /**
   * Salvar cache de preços de um usuário no Redis
   */
  async save(userId: string, gameId: string, cache: PriceCache): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}:${gameId}`;
      
      const data = JSON.stringify({
        price: cache.price,
        discount: cache.discount,
        lastUpdated: new Date().toISOString(),
      });
      
      // Salvar com TTL de 30 dias (preços antigos serão removidos)
      await redis.setex(key, 30 * 24 * 60 * 60, data);
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error saving:', error);
    }
  }

  /**
   * Carregar cache de preço de um jogo específico
   */
  async load(userId: string, gameId: string): Promise<PriceCache | null> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}:${gameId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return {
        price: parsed.price,
        discount: parsed.discount,
        lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : undefined,
      };
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error loading:', error);
      return null;
    }
  }

  /**
   * Carregar todos os caches de preços de um usuário
   */
  async loadUserPrices(userId: string): Promise<Map<string, PriceCache>> {
    try {
      const redis = getRedis();
      const priceMap = new Map<string, PriceCache>();
      
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor, 
          'MATCH', 
          `${REDIS_PREFIX}${userId}:*`, 
          'COUNT', 
          100
        );
        cursor = nextCursor;
        
        for (const key of keys) {
          const gameId = key.replace(`${REDIS_PREFIX}${userId}:`, '');
          const data = await redis.get(key);
          
          if (data) {
            const parsed = JSON.parse(data);
            priceMap.set(gameId, {
              price: parsed.price,
              discount: parsed.discount,
              lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : undefined,
            });
          }
        }
      } while (cursor !== '0');
      
      return priceMap;
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error loading user prices:', error);
      return new Map();
    }
  }

  /**
   * Carregar TODOS os caches de preços (para todos os usuários)
   */
  async loadAll(): Promise<Map<string, Map<string, PriceCache>>> {
    try {
      const redis = getRedis();
      const allPrices = new Map<string, Map<string, PriceCache>>();
      
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor, 
          'MATCH', 
          `${REDIS_PREFIX}*`, 
          'COUNT', 
          100
        );
        cursor = nextCursor;
        
        for (const key of keys) {
          const parts = key.replace(REDIS_PREFIX, '').split(':');
          if (parts.length !== 2) continue;
          
          const [userId, gameId] = parts;
          const data = await redis.get(key);
          
          if (data) {
            const parsed = JSON.parse(data);
            
            if (!allPrices.has(userId)) {
              allPrices.set(userId, new Map());
            }
            
            allPrices.get(userId)!.set(gameId, {
              price: parsed.price,
              discount: parsed.discount,
              lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : undefined,
            });
          }
        }
      } while (cursor !== '0');
      
      console.log(`[PriceCachePersistence] ✅ Loaded price caches for ${allPrices.size} users`);
      return allPrices;
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error loading all:', error);
      return new Map();
    }
  }

  /**
   * Deletar cache de preço de um jogo
   */
  async delete(userId: string, gameId: string): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}:${gameId}`;
      await redis.del(key);
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error deleting:', error);
    }
  }

  /**
   * Deletar todos os caches de um usuário
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor, 
          'MATCH', 
          `${REDIS_PREFIX}${userId}:*`, 
          'COUNT', 
          100
        );
        cursor = nextCursor;
        
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      
      console.log(`[PriceCachePersistence] 🗑️ Deleted price caches for ${userId}`);
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error deleting user:', error);
    }
  }

  /**
   * Limpar todos os caches (usar com cuidado)
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
      
      console.log(`[PriceCachePersistence] 🧹 Cleared ${deletedCount} price caches`);
    } catch (error) {
      console.error('[PriceCachePersistence] ❌ Error clearing:', error);
    }
  }
}

// Singleton instance
export const priceCachePersistence = new PriceCachePersistence();
