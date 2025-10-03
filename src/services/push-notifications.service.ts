import { Expo } from 'expo-server-sdk'

// Criar instância do Expo SDK
const expo = new Expo()

// Lista de tokens de push dos usuários (em produção viria do banco)
const userPushTokens = new Set<string>()

export interface BestPriceNotificationData {
  gameId: string
  gameTitle: string
  price: number
  store: string
  previousBest: number
}

export async function sendBestPriceNotification(data: BestPriceNotificationData) {
  const { gameTitle, price, store, previousBest } = data
  
  const messages = Array.from(userPushTokens)
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to: token,
      sound: 'default' as const,
      title: '🔥 Melhor Preço Histórico!',
      body: `${gameTitle} está por R$ ${price.toFixed(2)} na ${store}! (antes: R$ ${previousBest.toFixed(2)})`,
      data: {
        type: 'best_price_alert',
        gameId: data.gameId,
        gameTitle,
        price,
        store,
        url: `/game/${data.gameId}`
      },
      priority: 'high' as const,
      channelId: 'price-alerts'
    }))

  if (messages.length === 0) {
    console.log('Nenhum token de push registrado')
    return
  }

  console.log(`Enviando ${messages.length} notificações de melhor preço para ${gameTitle}`)

  // Enviar notificações em lotes
  const chunks = expo.chunkPushNotifications(messages)
  const tickets = []

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
      tickets.push(...ticketChunk)
    } catch (error) {
      console.error('Erro ao enviar lote de notificações:', error)
    }
  }

  // Verificar recibos (opcional - para tracking de entrega)
  const receiptIds = tickets
    .filter(ticket => ticket.status === 'ok')
    .map(ticket => ticket.id)

  if (receiptIds.length > 0) {
    console.log(`${receiptIds.length} notificações enviadas com sucesso`)
  }

  return tickets
}

export function addUserPushToken(token: string) {
  if (Expo.isExpoPushToken(token)) {
    userPushTokens.add(token)
    console.log('Token de push registrado:', token)
    return true
  } else {
    console.warn('Token de push inválido:', token)
    return false
  }
}

export function removeUserPushToken(token: string) {
  const removed = userPushTokens.delete(token)
  if (removed) {
    console.log('Token de push removido:', token)
  }
  return removed
}

export function getUserPushTokensCount(): number {
  return userPushTokens.size
}