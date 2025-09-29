export function calcDiscountPct(base: number, final: number) {
  if (!base || base <= 0) return 0
  return Math.round(((base - final) / base) * 100)
}
