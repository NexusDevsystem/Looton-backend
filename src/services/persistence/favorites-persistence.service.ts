/**
 * Serviço de persistência para Favoritos usando Redis
 * Garante que favoritos não sejam perdidos ao reiniciar o servidor
 */

import { getRedis } from '../../lib/redis.js';

interface Favorite {
  _id: string;
  userId: string;
  gameId: string;
  title?: string;
  stores?: string[];
  notifyUp?: boolean;
  notifyDown?: boolean;
  pctThreshold?: number;
  desiredPriceCents?: number;
  desiredPrice?: number;
  listId?: string;
  createdAt: Date;
}

const REDIS_PREFIX = 'favorites:';

export class FavoritesPersistence {
  /**
   * Salvar favoritos de um usuário no Redis
   */
  async save(userId: string, favorites: Favorite[]): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}`;
      
      const data = JSON.stringify(
        favorites.map(fav => ({
          ...fav,
          createdAt: fav.createdAt.toISOString(),
        }))
      );
      
      // Salvar com TTL de 180 dias
      await redis.setex(key, 180 * 24 * 60 * 60, data);
      
      console.log(`[FavoritesPersistence] ✅ Saved ${favorites.length} favorites for ${userId}`);
    } catch (error) {
      console.error('[FavoritesPersistence] ❌ Error saving:', error);
    }
  }

  /**
   * Carregar favoritos de um usuário do Redis
   */
  async load(userId: string): Promise<Favorite[]> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}`;
      const data = await redis.get(key);
      
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return parsed.map((fav: any) => ({
        ...fav,
        createdAt: new Date(fav.createdAt),
      }));
    } catch (error) {
      console.error('[FavoritesPersistence] ❌ Error loading:', error);
      return [];
    }
  }

  /**
   * Adicionar um favorito
   */
  async addFavorite(userId: string, favorite: Favorite): Promise<void> {
    const favorites = await this.load(userId);
    
    // Verificar se já existe
    const exists = favorites.find(f => f.gameId === favorite.gameId);
    if (exists) {
      throw new Error('Favorite already exists');
    }
    
    favorites.push(favorite);
    await this.save(userId, favorites);
  }

  /**
   * Remover um favorito
   */
  async removeFavorite(userId: string, favoriteId: string): Promise<boolean> {
    const favorites = await this.load(userId);
    const index = favorites.findIndex(f => f._id === favoriteId);
    
    if (index === -1) return false;
    
    favorites.splice(index, 1);
    await this.save(userId, favorites);
    return true;
  }

  /**
   * Atualizar um favorito
   */
  async updateFavorite(userId: string, favoriteId: string, updates: Partial<Favorite>): Promise<boolean> {
    const favorites = await this.load(userId);
    const index = favorites.findIndex(f => f._id === favoriteId);
    
    if (index === -1) return false;
    
    favorites[index] = {
      ...favorites[index],
      ...updates,
    };
    
    await this.save(userId, favorites);
    return true;
  }

  /**
   * Carregar todos os favoritos de todos os usuários
   */
  async loadAll(): Promise<Map<string, Favorite[]>> {
    try {
      const redis = getRedis();
      const favoritesMap = new Map<string, Favorite[]>();
      
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${REDIS_PREFIX}*`, 'COUNT', 100);
        cursor = nextCursor;
        
        for (const key of keys) {
          const userId = key.replace(REDIS_PREFIX, '');
          const favorites = await this.load(userId);
          favoritesMap.set(userId, favorites);
        }
      } while (cursor !== '0');
      
      console.log(`[FavoritesPersistence] ✅ Loaded favorites for ${favoritesMap.size} users from Redis`);
      return favoritesMap;
    } catch (error) {
      console.error('[FavoritesPersistence] ❌ Error loading all:', error);
      return new Map();
    }
  }

  /**
   * Deletar todos os favoritos de um usuário
   */
  async delete(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      const key = `${REDIS_PREFIX}${userId}`;
      await redis.del(key);
      console.log(`[FavoritesPersistence] 🗑️ Deleted favorites for ${userId}`);
    } catch (error) {
      console.error('[FavoritesPersistence] ❌ Error deleting:', error);
    }
  }

  /**
   * Limpar todos os favoritos (usar com cuidado)
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
      
      console.log(`[FavoritesPersistence] 🧹 Cleared ${deletedCount} favorite lists`);
    } catch (error) {
      console.error('[FavoritesPersistence] ❌ Error clearing:', error);
    }
  }
}

// Singleton instance
export const favoritesPersistence = new FavoritesPersistence();
