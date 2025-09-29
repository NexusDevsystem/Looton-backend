import { steamAdapter } from '../adapters/steam.adapter.js'
import { upsertOffersAndNotify } from '../services/offers.service.js'

export async function runUpdateAllStores() {
  const steam = await steamAdapter.fetchTrending()
  await upsertOffersAndNotify(steam)
}
