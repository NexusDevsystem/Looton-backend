export const roundHalfUp = (n: number) => Math.round(n);

export const computeDiscountedCents = (initialCents: number, discountPercent: number) =>
  roundHalfUp(initialCents * (1 - discountPercent / 100));

export interface SteamPrice {
  currency: string | null;       // e.g., 'BRL'
  initialCents: number | null;   // base price
  finalCents: number | null;     // discounted price from Steam
  discountPercent: number | null;
}

export function formatCentsToReal(cents: number | null): string | null {
  if (cents === null) return null;
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}