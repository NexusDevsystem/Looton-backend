import { OfferDTO, StoreAdapter } from './types.js'

// Epic adapter temporariamente desabilitado
// Retorna arrays vazios para não interferir no sistema
export const epicAdapter: StoreAdapter = {
  async fetchTrending() {
    // Epic temporariamente desabilitado - focar apenas na Steam
    return []
  },

  async search(query: string) {
    // Epic temporariamente desabilitado - focar apenas na Steam
    return []
  },

  async fetchByIds(ids: string[]) {
    // Epic temporariamente desabilitado - focar apenas na Steam
    return []
  }
}
