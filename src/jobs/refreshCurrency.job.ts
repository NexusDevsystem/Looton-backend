import { getBRLRate } from '../adapters/currency.service.js'

export async function runRefreshCurrency() {
  // For now just refresh internal cache
  await getBRLRate('USD')
}
