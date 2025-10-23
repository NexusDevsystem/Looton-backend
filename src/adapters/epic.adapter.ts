import { OfferDTO, StoreAdapter } from './types.js'
import { listFreeGames } from '../integrations/epic/freeGames.js'

export const epicAdapter: StoreAdapter = {
  async fetchTrending() {
    // Obter os jogos em promoção da Epic Games
    const deals = await listFreeGames()
    return deals.map(deal => ({
      id: deal.id,
      title: deal.title,
      url: deal.stores[0]?.url || '',
      price: deal.stores[0]?.priceFinal || 0,
      originalPrice: deal.stores[0]?.priceBase || 0,
      discount: deal.stores[0]?.discountPct || 0,
      image: deal.coverUrl,
      store: 'epic'
    }))
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
