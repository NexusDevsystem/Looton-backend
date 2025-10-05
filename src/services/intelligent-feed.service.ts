import crypto from 'crypto'
import { OfferDTO } from '../adapters/types.js'

// Extended game type for intelligent feed
export type GameWithMetadata = OfferDTO & {
  lastDropAt?: string;     // ISO date of last price drop
  genres?: string[];       // canonical genre slugs
  tags?: string[];         // game tags for matching
  averageRating?: number;  // 0-100 rating score
  reviewCount?: number;    // number of reviews
}

export type FeedParams = {
  userId: string;
  genres?: string[];       // user preferences
  limit?: number;
  cursor?: number;
  seed?: string;           // optional: override seed
  excludeStores?: string[]; // stores to exclude
}

export type FeedResult = {
  items: GameWithMetadata[];
  nextCursor: number | null;
  seedUsed: string;
  totalAvailable: number;
}

// Utility functions
function hashSeed(s: string): number {
  return crypto.createHash('sha1').update(s).digest().readUInt32BE(0) / 0xffffffff;
}

function prng(seedStr: string) {
  // Simple deterministic LCG for noise
  let x = Math.floor(hashSeed(seedStr) * 2147483647);
  return () => (x = (1103515245 * x + 12345) % 2147483647) / 2147483647;
}

function daysSince(date?: string): number {
  if (!date) return Infinity;
  const d = new Date(date).getTime();
  if (!Number.isFinite(d)) return Infinity;
  return (Date.now() - d) / 86400000;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Scoring system with configurable weights
export interface ScoringWeights {
  discount: number;      // weight for discount percentage
  priceInverse: number;  // weight for price (inverted - lower is better)
  recency: number;       // weight for recent price drops
  genreMatch: number;    // weight for genre preferences
  storeBonus: number;    // weight for store preference
  rating: number;        // weight for game rating
  popularity: number;    // weight for review count (popularity)
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  discount: 0.35,      // High priority for discounts
  priceInverse: 0.20,  // Price consideration
  recency: 0.15,       // Recent drops are attractive
  genreMatch: 0.15,    // User preferences matter
  storeBonus: 0.05,    // Small bonus for preferred stores
  rating: 0.05,        // Quality consideration
  popularity: 0.05     // Popularity factor
};

function computeScore(
  game: GameWithMetadata, 
  prefGenres: Set<string>, 
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  // Discount score (0-1, higher is better)
  const discount = clamp01((game.discountPct ?? 0) / 100);
  
  // Price score (inverted - lower prices get higher scores)
  const priceInv = 1 - clamp01(Math.log10(Math.max(1, game.priceFinal * 100)) / 7);
  
  // Recency score (recent price drops within ~7 days get bonus)
  const recency = game.lastDropAt ? 
    clamp01(Math.exp(-daysSince(game.lastDropAt) / 7)) : 0;
  
  // Genre match score
  const genreMatch = (game.genres || game.tags || [])
    .some(g => prefGenres.has(g.toLowerCase())) ? 1 : 0;
  
  // Store bonus (prefer Steam/Epic)
  const storeBonus = ['steam', 'epic'].includes(game.store) ? 1 : 0.5;
  
  // Rating score (0-1, based on average rating)
  const rating = game.averageRating ? clamp01(game.averageRating / 100) : 0.5;
  
  // Popularity score (logarithmic scale for review count)
  const popularity = game.reviewCount ? 
    clamp01(Math.log10(Math.max(1, game.reviewCount)) / 6) : 0.3;
  
  // Weighted sum
  const score = 
    weights.discount * discount +
    weights.priceInverse * priceInv +
    weights.recency * recency +
    weights.genreMatch * genreMatch +
    weights.storeBonus * storeBonus +
    weights.rating * rating +
    weights.popularity * popularity;
  
  return score;
}

// Weighted shuffle: score + controlled noise
function weightedShuffle(
  items: GameWithMetadata[], 
  baseSeed: string, 
  prefGenres: Set<string>,
  weights?: ScoringWeights
): GameWithMetadata[] {
  const rnd = prng(baseSeed);
  
  return items
    .map(game => {
      const score = computeScore(game, prefGenres, weights);
      const noise = (rnd() - 0.5) * 0.2; // controlled noise ±0.1
      const key = score + noise;
      return { game, key, score };
    })
    .sort((a, b) => b.key - a.key) // descending by weighted score
    .map(x => x.game);
}

// Diversification by genre/store (light round-robin)
function diversify(items: GameWithMetadata[]): GameWithMetadata[] {
  const buckets = new Map<string, GameWithMetadata[]>();
  
  for (const item of items) {
    const primaryGenre = item.genres?.[0] || item.tags?.[0] || 'other';
    const key = `${item.store}:${primaryGenre}`;
    
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }
  
  // Interleave items from different buckets
  const keys = Array.from(buckets.keys());
  const result: GameWithMetadata[] = [];
  let hasItems = true;
  
  while (hasItems) {
    hasItems = false;
    for (const key of keys) {
      const bucket = buckets.get(key)!;
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
        hasItems = true;
      }
    }
  }
  
  return result;
}

// Deduplication by storeAppId
function dedup(items: GameWithMetadata[]): GameWithMetadata[] {
  const seen = new Set<string>();
  const result: GameWithMetadata[] = [];
  
  for (const item of items) {
    const key = `${item.store}:${item.storeAppId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  
  return result;
}

// Main intelligent feed function
export async function getIntelligentFeed(
  params: FeedParams,
  allGames: GameWithMetadata[],
  served24h: Set<string>,
  weights?: ScoringWeights
): Promise<FeedResult> {
  const limit = params.limit ?? 20;
  const cursor = params.cursor ?? 0;
  
  // User preferences
  const prefGenres = new Set((params.genres ?? []).map(g => g.toLowerCase()));
  const excludeStores = new Set(params.excludeStores ?? []);
  
  // 1) Filter by preferences and exclude already served
  let pool = allGames.filter(game => 
    !served24h.has(`${game.store}:${game.storeAppId}`) &&
    !excludeStores.has(game.store) &&
    game.isActive
  );
  
  // Separate games by genre preference
  const withPref = pool.filter(game => 
    (game.genres || game.tags || [])
      .some(g => prefGenres.has(g.toLowerCase()))
  );
  const withoutPref = pool.filter(game => 
    !(game.genres || game.tags || [])
      .some(g => prefGenres.has(g.toLowerCase()))
  );
  
  // Prioritize preferred genres but keep fallback
  pool = withPref.length >= limit ? withPref : [...withPref, ...withoutPref];
  
  // 2) Deterministic seed based on user + 6h time window
  const window6h = Math.floor(Date.now() / (6 * 3600 * 1000));
  const seed = params.seed ?? `${params.userId}:${window6h}`;
  
  // 3) Intelligent scoring + weighted shuffle
  let ranked = weightedShuffle(pool, seed, prefGenres, weights);
  
  // 4) Apply deduplication and diversification
  ranked = dedup(ranked);
  ranked = diversify(ranked);
  
  // 5) Cursor-based pagination
  const totalAvailable = ranked.length;
  const slice = ranked.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < ranked.length ? cursor + limit : null;
  
  return {
    items: slice,
    nextCursor,
    seedUsed: seed,
    totalAvailable
  };
}

// Convert OfferDTO to GameWithMetadata for compatibility
export function enrichGameData(offer: OfferDTO): GameWithMetadata {
  return {
    ...offer,
    lastDropAt: undefined, // Could be populated from price history
    averageRating: undefined, // Could be fetched from store APIs
    reviewCount: undefined // Could be fetched from store APIs
  };
}