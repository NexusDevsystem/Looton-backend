export type OfferDTO = {
  store: 'steam' | 'epic' | 'ubisoft'
  storeAppId: string
  title: string
  url: string
  // NEW: cents-based fields (recommended)
  priceBaseCents: number | null
  priceFinalCents: number | null
  discountPct: number | null
  currency?: string
  // LEGACY: reais-based fields (for backward compatibility)
  priceBase: number
  priceFinal: number
  isActive: boolean
  coverUrl?: string
  genres?: string[]
  tags?: string[]
  
  // NSFW Shield: Dados oficiais da Steam/Epic
  required_age?: number
  content_descriptors?: string[]
}

export interface StoreAdapter {
  fetchTrending(): Promise<OfferDTO[]>
  search(query: string): Promise<OfferDTO[]>
  fetchByIds(ids: string[]): Promise<OfferDTO[]>
}
