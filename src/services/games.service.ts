import { OfferDTO, StoreAdapter } from '../adapters/types.js'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { epicAdapter } from '../adapters/epic.adapter.js'
import { gogAdapter } from '../adapters/gog.adapter.js'
import { upsertOffersAndNotify } from './offers.service.js'
import { redis } from '../lib/redis.js'

const adapters: Record<string, StoreAdapter> = {
  steam: steamAdapter,
  epic: epicAdapter,
  gog: gogAdapter
}

export async function searchGames(query: string, stores?: string[]) {
  const list = stores?.length ? stores : Object.keys(adapters)
  const cacheKey = `cache:search:${query}:${list.sort().join(',')}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  const results: OfferDTO[] = []
  for (const s of list) {
    const adapter = adapters[s]
    if (!adapter) continue
    const items = await adapter.search(query)
    results.push(...items)
  }
  // persist offers and games for search results
  await upsertOffersAndNotify(results)
  await redis.setex(cacheKey, 30, JSON.stringify(results))
  return results
}
