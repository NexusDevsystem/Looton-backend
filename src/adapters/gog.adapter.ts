import { OfferDTO, StoreAdapter } from './types.js'
import { env } from '../env.js'

const mock: OfferDTO[] = [
  {
    store: 'gog',
    storeAppId: '1207664643',
    title: 'Cyberpunk 2077',
    url: 'https://www.gog.com/en/game/cyberpunk_2077',
    priceBase: 199.99,
    priceFinal: 99.99,
    discountPct: 50,
    isActive: true
  }
]

export const gogAdapter: StoreAdapter = {
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
