import { createQueue, createWorker } from '../lib/queue.js'
import { env } from '../env.js'
import { runUpdateAllStores } from './updateAllStores.job.js'
import { runRefreshCurrency } from './refreshCurrency.job.js'

export async function startJobs() {
  const { queue: q1 } = createQueue<'updateAllStores'>('updateAllStores')
  await q1.add('updateAllStores', {}, { repeat: { pattern: env.DEALS_REFRESH_CRON } })
  createWorker<'updateAllStores'>('updateAllStores', async () => runUpdateAllStores())

  const { queue: q2 } = createQueue<'refreshCurrency'>('refreshCurrency')
  await q2.add('refreshCurrency', {}, { repeat: { pattern: env.CURRENCY_REFRESH_CRON } })
  createWorker<'refreshCurrency'>('refreshCurrency', async () => runRefreshCurrency())

  // kick once on startup (non-blocking)
  q1.add('updateAllStores', {})
}
// Removed unused runAllNow helper to reduce surface area.
