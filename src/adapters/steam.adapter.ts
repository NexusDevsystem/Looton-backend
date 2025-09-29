import { OfferDTO, StoreAdapter } from './types.js'
import { env } from '../env.js'

const mockOffers: OfferDTO[] = [
  {
    store: 'steam',
    storeAppId: '570',
    title: 'Dota 2 Battle Bundle',
    url: 'https://store.steampowered.com/app/570',
    priceBase: 49.99,
    priceFinal: 9.99,
    discountPct: 80,
    isActive: true,
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '292030',
    title: 'The Witcher 3: Wild Hunt',
    url: 'https://store.steampowered.com/app/292030',
    priceBase: 99.99,
    priceFinal: 29.99,
    discountPct: 70,
    isActive: true,
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg'
  }
]

export const steamAdapter: StoreAdapter = {
  async fetchTrending() {
    if (env.USE_MOCK_ADAPTERS) return mockOffers
    // TODO: Implement real Steam fetching respecting TOS, or keep mock
    return mockOffers
  },
  async search(query: string) {
    if (env.USE_MOCK_ADAPTERS) {
      const q = query.toLowerCase()
      return mockOffers.filter(o => o.title.toLowerCase().includes(q))
    }
    return []
  },
  async fetchByIds(ids: string[]) {
    if (env.USE_MOCK_ADAPTERS) {
      return mockOffers.filter(o => ids.includes(o.storeAppId))
    }
    return []
  }
}
