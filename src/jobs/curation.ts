import cron from 'node-cron'
import { env } from '../env.js'
import { getDailySteamDeals, clearDailyDealsCache } from '../services/daily-steam-deals.service.js'

export function startCurationJob() {
  // run once at startup - atualiza o cache
  getDailySteamDeals().catch((e) => console.error('daily deals initial error', e))

  // schedule - atualiza o cache diariamente
  cron.schedule(env.CURATION_CRON, async () => {
    try {
      // Limpa o cache para forçar uma nova busca
      clearDailyDealsCache();
      await getDailySteamDeals();
      console.log('[curation] daily deals cache updated')
    } catch (e) {
      console.error('[curation] daily deals job error', e)
    }
  })
}