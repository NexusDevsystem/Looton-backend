import { env } from '../env.js'

/**
 * Remove ofertas que não foram vistas recentemente
 * Isso evita que ofertas desatualizadas fiquem aparecendo no feed
 */
export async function cleanupExpiredOffers(): Promise<number> {
  try {
    const daysThreshold = env.OFFERS_EXPIRATION_DAYS || 7 // 7 dias padrão
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold)

    // Implementação temporária sem banco de dados
    // Em um sistema real, você usaria um cache em memória ou outro sistema
    
    console.log(`[cleanup] Desativadas ofertas antigas simuladas (cutoff: ${cutoffDate.toISOString()})`)
    
    // Simular número de ofertas desativadas
    return 0
  } catch (error) {
    console.error('[cleanup] Erro ao desativar ofertas antigas:', error)
    throw error
  }
}