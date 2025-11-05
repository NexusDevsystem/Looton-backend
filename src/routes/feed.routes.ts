import { FastifyInstance } from 'fastify'
import { getIntelligentFeed, enrichGameData, FeedParams } from '../services/intelligent-feed.service.js'
import { servedGamesTracker } from '../services/served-games-cache.service.js'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { getCurrentFeed } from '../services/curate.js'
import { filterInappropriateGames } from '../utils/content-filter.js'

export default async function feedRoutes(app: FastifyInstance) {
  // Legacy curated feed endpoint (keep for compatibility)
  app.get('/feed/curated', async (_req, reply) => {
    const feed = getCurrentFeed()
    return reply.send(feed)
  })

  // GET /feed - Intelligent rotating feed
  app.get('/feed', async (request, reply) => {
    const query = request.query as any;
    const {
      userId = 'anonymous',
      genres = '',
      limit = '20',
      cursor = '0',
      seed,
      excludeStores = ''
    } = query;

    try {
      // Parse parameters
      const feedParams: FeedParams = {
        userId: String(userId),
        genres: genres ? String(genres).split(',').filter(Boolean) : [],
        limit: Math.min(50, Math.max(1, parseInt(limit) || 20)), // Cap at 50
        cursor: Math.max(0, parseInt(cursor) || 0),
        seed: seed ? String(seed) : undefined,
        excludeStores: excludeStores ? String(excludeStores).split(',').filter(Boolean) : []
      };

      // Get cached games from adapters
      console.log('Fetching games from adapters...');
      const [steamGames] = await Promise.all([
        steamAdapter.fetchTrending().catch((err: any) => {
          console.error('Steam adapter failed:', err);
          return [];
        })
      ]);

      // Combine and enrich game data
      const allOffers = [...steamGames];
      const allGames = allOffers.map(enrichGameData);
      
      // 🔒 FILTRAR CONTEÚDO IMPRÓPRIO
      const safeGames = filterInappropriateGames(allGames);
      
      console.log(`Combined ${safeGames.length} safe games from ${steamGames.length} Steam (${allGames.length - safeGames.length} filtered)`);

      // Get served games for this user
      const servedGames = servedGamesTracker.getServedGames(feedParams.userId);

      // Generate intelligent feed
      const result = await getIntelligentFeed(feedParams, safeGames, servedGames);
      
      // Track served games
      if (result.items.length > 0) {
        const gameKeys = result.items.map(item => `${item.store}:${item.storeAppId}`);
        servedGamesTracker.addServedGames(feedParams.userId, gameKeys);
      }

      // Set cache headers
      reply
        .header('Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
        .header('X-Total-Available', result.totalAvailable.toString())
        .header('X-Seed-Used', result.seedUsed);

      return {
        items: result.items,
        nextCursor: result.nextCursor,
        totalAvailable: result.totalAvailable,
        seed: result.seedUsed,
        metadata: {
          userId: feedParams.userId,
          limit: feedParams.limit,
          cursor: feedParams.cursor,
          genres: feedParams.genres,
          excludeStores: feedParams.excludeStores,
          servedBefore: servedGames.size
        }
      };

    } catch (error) {
      console.error('Feed endpoint error:', error);
      
      reply.status(500);
      return {
        error: 'Failed to generate feed',
        message: error instanceof Error ? error.message : 'Unknown error',
        items: [],
        nextCursor: null,
        totalAvailable: 0
      };
    }
  });

  // GET /feed/stats - Debug endpoint for cache stats
  app.get('/feed/stats', async (request, reply) => {
    const stats = servedGamesTracker.getStats();
    
    return {
      servedGamesCache: stats,
      timestamp: new Date().toISOString()
    };
  });

  // POST /feed/reset/:userId - Reset served games for user (debug/test)
  app.post('/feed/reset/:userId', async (request, reply) => {
    const { userId } = request.params as any;
    
    if (!userId) {
      reply.status(400);
      return { error: 'userId required' };
    }
    
    servedGamesTracker.clearUser(String(userId));
    
    return {
      message: `Reset served games for user: ${userId}`,
      timestamp: new Date().toISOString()
    };
  });

  // GET /feed/weights - Get current scoring weights
  app.get('/feed/weights', async (request, reply) => {
    return {
      weights: {
        discount: 0.35,
        priceInverse: 0.20,
        recency: 0.15,
        genreMatch: 0.15,
        storeBonus: 0.05,
        rating: 0.05,
        popularity: 0.05
      },
      description: {
        discount: 'Weight for discount percentage (0-100%)',
        priceInverse: 'Weight for price consideration (lower is better)',
        recency: 'Weight for recent price drops (~7 days)',
        genreMatch: 'Weight for user genre preferences',
        storeBonus: 'Weight for preferred stores (Steam/Epic)',
        rating: 'Weight for game quality/rating',
        popularity: 'Weight for review count/popularity'
      }
    };
  });
}