// Simple in-memory cache for tracking served games (24h anti-repetition)
// In production, this should use Redis for persistence across server restarts

interface ServedGameCache {
  [userId: string]: {
    games: Set<string>;
    expiry: number;
  };
}

class ServedGamesTracker {
  private cache: ServedGameCache = {};
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Get games served to user in last 24h
  getServedGames(userId: string): Set<string> {
    const entry = this.cache[userId];
    if (!entry) return new Set();
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      delete this.cache[userId];
      return new Set();
    }
    
    return entry.games;
  }

  // Add games to served list for user
  addServedGames(userId: string, gameIds: string[]): void {
    if (!this.cache[userId]) {
      this.cache[userId] = {
        games: new Set(),
        expiry: Date.now() + this.TTL_MS
      };
    } else {
      // Extend expiry for existing entry
      this.cache[userId].expiry = Date.now() + this.TTL_MS;
    }

    for (const gameId of gameIds) {
      this.cache[userId].games.add(gameId);
    }
  }

  // Clean up expired entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const userId in this.cache) {
      if (now > this.cache[userId].expiry) {
        delete this.cache[userId];
      }
    }
  }

  // Get cache stats for debugging
  getStats(): { totalUsers: number; totalEntries: number } {
    let totalEntries = 0;
    for (const userId in this.cache) {
      totalEntries += this.cache[userId].games.size;
    }
    
    return {
      totalUsers: Object.keys(this.cache).length,
      totalEntries
    };
  }

  // Clear all cache (useful for testing)
  clear(): void {
    this.cache = {};
  }

  // Remove specific user from cache
  clearUser(userId: string): void {
    delete this.cache[userId];
  }
}

// Singleton instance
export const servedGamesTracker = new ServedGamesTracker();

// Auto-cleanup every hour
setInterval(() => {
  servedGamesTracker.cleanup();
}, 60 * 60 * 1000);