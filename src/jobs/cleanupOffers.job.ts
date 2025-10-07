import cron from 'node-cron'
import { cleanupExpiredOffers } from '../services/cleanup-offers.service.js'
import { env } from '../env.js'

export function startCleanupJob() {
  // Executa a cada 6 horas, por exemplo
  cron.schedule(env.OFFERS_CLEANUP_CRON || '0 */6 * * *', async () => {
    try {
      console.log('[cleanup] Iniciando limpeza de ofertas antigas...')
      const deactivatedCount = await cleanupExpiredOffers()
      console.log(`[cleanup] Limpeza concluída. Desativadas ${deactivatedCount} ofertas.`)
    } catch (e) {
      console.error('[cleanup] Erro na execução do job de limpeza:', e)
    }
  })

  // Executar uma vez na inicialização também
  console.log('[cleanup] Executando limpeza inicial...')
  cleanupExpiredOffers().catch(e => console.error('[cleanup] Erro na limpeza inicial:', e))
}