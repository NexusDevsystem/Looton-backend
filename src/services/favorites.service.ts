import { Types } from 'mongoose'
import { Favorite } from '../db/models/Favorite.js'
import { Offer } from '../db/models/Offer.js'
import { PriceHistory } from '../db/models/PriceHistory.js'

// Lightweight in-process lock to prevent duplicate concurrent processing per gameId
const processingLock = new Set<string>()

export interface NotificationData {
  favoriteId: Types.ObjectId
  gameTitle: string
  oldPrice: number
  newPrice: number
  discountPct: number
  storeName: string
  type: 'price_drop' | 'price_increase' | 'new_lowest_90d'
}

// Função para verificar se deve notificar sobre mudança de preço
export async function checkFavoritesAndNotify(gameId: Types.ObjectId, offer: any) {
  // Simple in-process processing lock to avoid duplicate processing in short windows
  // (prevents double notifications if the same job triggers quickly). For cross-process
  // locking use Redis/queue locks; this is a lightweight safeguard.
  const key = String(gameId)
  if (processingLock.has(key)) return
  processingLock.add(key)
  // release lock after short delay to allow subsequent updates
  setTimeout(() => processingLock.delete(key), 5 * 1000)

  // Buscar todos os favoritos para este jogo
  const favorites = await Favorite.find({ gameId })
    .populate('gameId')
    .populate({
      path: 'gameId',
      populate: {
        path: 'storeId',
        model: 'Store'
      }
    })

  if (favorites.length === 0) return

  // Buscar ofertas anteriores para comparação
  const previousOffer = await Offer.findOne({
    gameId,
    storeId: offer.storeId,
    isActive: false
  }).sort({ createdAt: -1 })

  if (!previousOffer) return

  const oldPrice = toCents(previousOffer.priceFinal)
  const newPrice = toCents(offer.priceFinal)
  const priceChange = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0

  // Verificar se é o menor preço em 90 dias
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const lowestIn90Days = await PriceHistory.findOne({
    gameId,
    seenAt: { $gte: ninetyDaysAgo }
  }).sort({ priceFinalCents: 1 })

  const isNewLowest90d = !lowestIn90Days || newPrice < (lowestIn90Days.priceFinal * 100)

    // derive a store key: prefer offer.storeKey/offer.store if present, else use storeId string
    const storeKey = offer.storeKey || offer.store || String(offer.storeId)

    for (const favorite of favorites) {
      // If favorite specifies stores, only notify for matching store
      if (!matchesStore(favorite, storeKey)) continue

      // If user set an absolute desired price (in cents), notify when newPrice <= desiredPriceCents (respect cooldown)
      const desiredTrigger = shouldTriggerDesiredPrice(favorite, newPrice)

      let shouldNotify = false
      let notificationType: NotificationData['type'] = 'price_drop'

      if (desiredTrigger) {
        if (!isInCooldown(favorite)) {
          shouldNotify = true
          notificationType = 'price_drop'
        }
      } else {
        // fallback to existing threshold/lowest logic
        const should = await shouldSendNotification(favorite, priceChange, isNewLowest90d)
        if (should) {
          shouldNotify = true
          notificationType = getNotificationType(priceChange, isNewLowest90d, favorite)
        }
      }

      if (shouldNotify) {
        // send notification (catch errors to avoid failing the entire loop)
        try {
          await sendNotification({
            favoriteId: favorite._id,
            gameTitle: (favorite.gameId as any).title,
            oldPrice: oldPrice / 100,
            newPrice: newPrice / 100,
            discountPct: offer.discountPct,
            storeName: (favorite.gameId as any).storeId?.name || storeKey,
            type: notificationType,
            ...(desiredTrigger && { desiredPrice: (favorite.desiredPriceCents || 0) / 100 })
          })

          // Atualizar timestamp da última notificação
          favorite.lastNotifiedAt = new Date()
          await favorite.save()
        } catch (err) {
          console.error('Error sending notification or saving favorite:', err)
        }
      }
    }
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
export async function verifyPriceChangeDebounce(gameId: Types.ObjectId, storeId: Types.ObjectId): Promise<boolean> {
  // Buscar as duas últimas ofertas para verificar consistência
  const lastTwoOffers = await Offer.find({
    gameId,
    storeId,
    isActive: false
  })
    .sort({ createdAt: -1 })
    .limit(2)

  if (lastTwoOffers.length < 2) return true

  const [latest, previous] = lastTwoOffers
  
  // Verificar se o preço mudou de forma consistente
  const priceStable = Math.abs((latest.priceFinal * 100) - (previous.priceFinal * 100)) < 10 // 10 centavos de tolerância
  
  return priceStable
}