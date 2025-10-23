// Lightweight in-process lock to prevent duplicate concurrent processing per gameId
const processingLock = new Set<string>()

export interface NotificationData {
  favoriteId: string
  gameTitle: string
  oldPrice: number
  newPrice: number
  discountPct: number
  storeName: string
  type: 'price_drop' | 'price_increase' | 'new_lowest_90d'
}

// Função para verificar se deve notificar sobre mudança de preço
export async function checkFavoritesAndNotify(gameId: string, offer: any) {
  // Simple in-process processing lock to avoid duplicate processing in short windows
  // (prevents double notifications if the same job triggers quickly). For cross-process
  // locking use Redis/queue locks; this is a lightweight safeguard.
  const key = String(gameId)
  if (processingLock.has(key)) return
  processingLock.add(key)
  // release lock after short delay to allow subsequent updates
  setTimeout(() => processingLock.delete(key), 5 * 1000)

  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  console.log(`Check favorites and notify for game ${gameId}`)
}

export function shouldTriggerDesiredPrice(favorite: any, newPriceCents: number) {
  if (!favorite) return false
  if (favorite.desiredPriceCents === undefined || favorite.desiredPriceCents === null) return false
  // Ensure numeric
  const desired = Number(favorite.desiredPriceCents)
  if (Number.isNaN(desired)) return false
  return newPriceCents <= desired
}

export function isInCooldown(fav: any, now = new Date(), cooldownMs = 24 * 60 * 60 * 1000) {
  if (!fav || !fav.lastNotifiedAt) return false
  const timeSinceLastNotification = now.getTime() - new Date(fav.lastNotifiedAt).getTime()
  return timeSinceLastNotification < cooldownMs
}

export function matchesStore(fav: any, offerStoreKey: string) {
  if (!fav.stores || fav.stores.length === 0) return true
  return fav.stores.includes(offerStoreKey)
}

export function toCents(price: number) {
  // Use floor to avoid rounding up values like 29.999 -> 3000 in tests; treat price as a decimal currency value
  return Math.floor(price * 100)
}

async function shouldSendNotification(favorite: any, priceChange: number, isNewLowest90d: boolean): Promise<boolean> {
  // Verificar cooldown de 24h
  if (favorite.lastNotifiedAt) {
    const now = new Date()
    const timeSinceLastNotification = now.getTime() - favorite.lastNotifiedAt.getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000
    
    if (timeSinceLastNotification < twentyFourHours) {
      return false
    }
  }

  const threshold = favorite.pctThreshold || 10

  // Notificar sobre queda de preço
  if (priceChange <= -threshold && favorite.notifyDown !== false) {
    return true
  }

  // Notificar sobre aumento (se habilitado)
  if (priceChange >= threshold && favorite.notifyUp === true) {
    return true
  }

  // Notificar sobre novo menor preço em 90 dias (mesmo que a mudança seja pequena)
  if (isNewLowest90d && priceChange < 0) {
    return true
  }

  return false
}
export { shouldSendNotification }

export function getNotificationType(priceChange: number, isNewLowest90d: boolean, favorite: any): NotificationData['type'] {
  if (isNewLowest90d && priceChange < 0) {
    return 'new_lowest_90d'
  }
  
  if (priceChange < 0) {
    return 'price_drop'
  }
  
  return 'price_increase'
}

async function sendNotification(data: NotificationData) {
  // Default mock: log. If EXPO_PUSH_ENABLED is set, we'll try to use expo-server-sdk to send push notifications.
  console.log(`🔔 Notificação (mock): ${data.gameTitle}`)
  console.log(`   Preço: R$ ${data.oldPrice.toFixed(2)} → R$ ${data.newPrice.toFixed(2)}`)
  console.log(`   Desconto: ${data.discountPct}% na ${data.storeName}`)
  console.log(`   Tipo: ${data.type}`)

  try {
    // dynamic import to avoid adding dependency unless env enabled
    if (process.env.EXPO_PUSH_ENABLED === 'true') {
      const { Expo } = await import('expo-server-sdk')
      const expo = new Expo()

      // favorite -> we don't have push tokens per favorite here; in debug flows client can pass tokens
      // For now, if data has a pushToken field, use it (debug endpoint sets it). Otherwise no-op.
      // @ts-ignore
      const pushToken = (data as any).pushToken
      if (pushToken && Expo.isExpoPushToken(pushToken)) {
        const messages = [{
          to: pushToken,
          sound: 'default',
          title: `Promoção: ${data.gameTitle}`,
          body: `R$ ${data.oldPrice.toFixed(2)} → R$ ${data.newPrice.toFixed(2)} (${data.discountPct}%)`,
          data: { favoriteId: String(data.favoriteId), type: data.type }
        }]

        const chunks = expo.chunkPushNotifications(messages)
        for (const chunk of chunks) {
          const receipts = await expo.sendPushNotificationsAsync(chunk)
          console.log('Expo receipts', receipts)
        }
      }
    }
  } catch (err) {
    console.error('Error sending expo notification', err)
  }
}

// Função para verificar debounce (2 coletas consecutivas)
export async function verifyPriceChangeDebounce(gameId: string, storeId: string): Promise<boolean> {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria um cache em memória ou outro sistema
  console.log(`Verify price change debounce for game ${gameId} and store ${storeId}`)
  return true
}