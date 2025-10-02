export function centsToCurrency(cents?: number): number {
  if (!cents || !Number.isFinite(cents)) return 0
  return Number((cents / 100).toFixed(2))
}

export function discountPct(initial?: number, final?: number): number {
  if (!initial || !final || initial <= 0) return 0
  return Math.round(((initial - final) / initial) * 100)
}export function calcDiscountPct(base: number, final: number) {
  if (!base || base <= 0) return 0
  return Math.round(((base - final) / base) * 100)
}
