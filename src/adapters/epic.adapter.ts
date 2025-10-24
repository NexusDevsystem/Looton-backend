import { OfferDTO, StoreAdapter } from './types.js'
import { listFreeGames } from '../integrations/epic/freeGames.js'

export const epicAdapter: StoreAdapter = {
  async fetchTrending() {
    // Obter os jogos em promoção da Epic Games
    const deals = await listFreeGames()
    return deals.map(deal => ({
      store: 'epic',
      storeAppId: deal.stores[0]?.storeAppId || deal.id.split(':')[1] || '',
      title: deal.title,
      url: deal.stores[0]?.url || '',
      priceBaseCents: deal.stores[0]?.priceBase !== undefined ? Math.round(deal.stores[0].priceBase * 100) : null,
      priceFinalCents: deal.stores[0]?.priceFinal !== undefined ? Math.round(deal.stores[0].priceFinal * 100) : null,
      discountPct: deal.stores[0]?.discountPct || 0,
      priceBase: deal.stores[0]?.priceBase || 0,
      priceFinal: deal.stores[0]?.priceFinal || 0,
      isActive: true,
      coverUrl: deal.coverUrl,
      genres: deal.genres,
      tags: deal.tags,
      currency: deal.currency
    })) as OfferDTO[]
  },

  async search(query: string) {
    // A Epic não tem uma API de busca direta, então retornamos vazios por enquanto
    return []
  },

  async fetchByIds(ids: string[]) {
    // A Epic não tem uma API direta para buscar por IDs específicos, então retornamos vazios por enquanto
    return []
  }
}
