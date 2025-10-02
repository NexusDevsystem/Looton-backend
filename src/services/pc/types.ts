export type PcOffer = {
  store: string
  title: string
  url: string
  image?: string
  category?: string
  priceBaseCents?: number
  priceFinalCents: number
  discountPct?: number
  availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
  sku?: string
  ean?: string
  updatedAt: string // ISO
}

export type PcFeed = {
  slotDate: string // ISO
  items: PcOffer[]
}

export type FetchOptions = {
  limit?: number
  categories?: string[]
}
