export interface GameDeal {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  store: string;
  price: number;
  normalPrice: number;
  discountPct: number;
  url: string;
  currency: string;
  externalId: string;
  offers: GameOffer[];
}

export interface GameOffer {
  store: string;
  price: number;
  normalPrice: number;
  discountPct: number;
  url: string;
  currency: string;
  externalId: string;
}