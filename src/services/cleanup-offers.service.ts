import { Offer } from '../db/models/Offer.js'
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

    const result = await Offer.updateMany(
      {
        isActive: true,
        lastSeenAt: { $lt: cutoffDate }
      },
      {
        isActive: false
      }
    )

    console.log(`[cleanup] Desativadas ${result.modifiedCount} ofertas antigas (cutoff: ${cutoffDate.toISOString()})`)
    
    return result.modifiedCount
  } catch (error) {
    console.error('[cleanup] Erro ao desativar ofertas antigas:', error)
    throw error
  }
}