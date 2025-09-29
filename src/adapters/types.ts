export type OfferDTO = {
  store: 'steam' | 'epic' | 'gog'
  storeAppId: string
  title: string
  url: string
  priceBase: number
  priceFinal: number
  discountPct: number
  isActive: boolean
  coverUrl?: string
}

export interface StoreAdapter {
  fetchTrending(): Promise<OfferDTO[]>
  search(query: string): Promise<OfferDTO[]>
  fetchByIds(ids: string[]): Promise<OfferDTO[]>
}
