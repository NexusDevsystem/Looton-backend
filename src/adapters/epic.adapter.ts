import { OfferDTO, StoreAdapter } from './types.js'
import { env } from '../env.js'

const mock: OfferDTO[] = [
  {
    store: 'epic',
    storeAppId: 'fortnite',
    title: 'Fortnite Crew Pack',
    url: 'https://store.epicgames.com/en-US/p/fortnite',
    priceBase: 29.99,
    priceFinal: 19.99,
    discountPct: 33,
    isActive: true
  }
]

export const epicAdapter: StoreAdapter = {
  async fetchTrending() {
    return env.USE_MOCK_ADAPTERS ? mock : []
  },
  async search(query: string) {
    const q = query.toLowerCase()
    return (env.USE_MOCK_ADAPTERS ? mock : []).filter((o) => o.title.toLowerCase().includes(q))
  },
  async fetchByIds(ids: string[]) {
    return (env.USE_MOCK_ADAPTERS ? mock : []).filter((o) => ids.includes(o.storeAppId))
  }
}
