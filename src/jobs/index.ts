import { createQueue, createWorker } from '../lib/queue.js'
import { env } from '../env.js'
import { runUpdateAllStores } from './updateAllStores.job.js'
import { runRefreshCurrency } from './refreshCurrency.job.js'
import { startDailyOfferJob } from './dailyOffer.job.js'
import { startWatchedGamesJob } from './watchedGames.job.js'

export async function startJobs() {
  // Job para atualizar ofertas das lojas
  const { queue: q1 } = createQueue<'updateAllStores'>('updateAllStores')
  await q1.add('updateAllStores', {}, { repeat: { pattern: env.DEALS_REFRESH_CRON } })
  createWorker<'updateAllStores'>('updateAllStores', async () => runUpdateAllStores())
  console.log(`[Jobs] Atualização de ofertas: ${env.DEALS_REFRESH_CRON}`)

  // Job para atualizar cotação de moeda
  const { queue: q2 } = createQueue<'refreshCurrency'>('refreshCurrency')
  await q2.add('refreshCurrency', {}, { repeat: { pattern: env.CURRENCY_REFRESH_CRON } })
  createWorker<'refreshCurrency'>('refreshCurrency', async () => runRefreshCurrency())

  // ✅ NOTIFICAÇÃO 1: Oferta do Dia (2x por dia: 12h e 18h)
  startDailyOfferJob()

  // ✅ NOTIFICAÇÃO 2: Jogos Vigiados (a cada 1 hora)
  startWatchedGamesJob()

  // Executar uma vez ao iniciar
  q1.add('updateAllStores', {})
  
  console.log('✅ Todos os jobs iniciados com sucesso!')
}

