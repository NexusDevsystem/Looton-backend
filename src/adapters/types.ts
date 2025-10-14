export type OfferDTO = {
  store: 'steam' | 'epic'
  storeAppId: string
  title: string
  url: string
  // NEW: cents-based fields (recommended)
  priceBaseCents: number | null
  priceFinalCents: number | null
  discountPct: number | null
  currency?: string
  // LEGACY/ALIAS fields for compatibility with existing services
  priceOriginal?: number
  priceOriginalCents?: number
  trend?: number
  // LEGACY: reais-based fields (for backward compatibility)
  priceBase: number
  priceFinal: number
  isActive: boolean
  coverUrl?: string
  genres?: string[]
  tags?: string[]
}

export interface StoreAdapter {
  fetchTrending(): Promise<OfferDTO[]>
  search(query: string): Promise<OfferDTO[]>
  fetchByIds(ids: string[]): Promise<OfferDTO[]>
  // Optional fallback provided by some adapters
  fetchTopSellers?: () => Promise<OfferDTO[]>
}
