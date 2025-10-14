import { createQueue, createWorker } from '../lib/queue.js'
import { env } from '../env.js'
import { runUpdateAllStores } from './updateAllStores.job.js'
import { runRefreshCurrency } from './refreshCurrency.job.js'
import { runUpdatePermanentDealsCacheWithFallback } from './updatePermanentDealsCache.job.js'
import { startCleanupJob } from './cleanupOffers.job.js'

export async function startJobs() {
  const { queue: q1 } = createQueue<'updateAllStores'>('updateAllStores')
  await q1.add('updateAllStores', {}, { repeat: { pattern: env.DEALS_REFRESH_CRON } })
  createWorker<'updateAllStores'>('updateAllStores', async () => runUpdateAllStores())

  const { queue: q2 } = createQueue<'refreshCurrency'>('refreshCurrency')
  await q2.add('refreshCurrency', {}, { repeat: { pattern: env.CURRENCY_REFRESH_CRON } })
  createWorker<'refreshCurrency'>('refreshCurrency', async () => runRefreshCurrency())

  // Job para atualizar o cache de ofertas permanentes (garante ofertas sempre disponíveis)
  const { queue: q3 } = createQueue<'updatePermanentDealsCache'>('updatePermanentDealsCache')
  await q3.add('updatePermanentDealsCache', {}, { repeat: { pattern: env.DEALS_REFRESH_CRON } })
  createWorker<'updatePermanentDealsCache'>('updatePermanentDealsCache', async () => runUpdatePermanentDealsCacheWithFallback())

  // start cleanup job
  startCleanupJob()

  // kick once on startup (non-blocking)
  q1.add('updateAllStores', {})
  q3.add('updatePermanentDealsCache', {}) // também atualiza o cache permanente na inicialização
}
// Removed unused runAllNow helper to reduce surface area.
