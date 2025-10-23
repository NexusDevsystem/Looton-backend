import { Expo } from 'expo-server-sdk'

const expo = new Expo()

export async function sendPush(token: string, title: string, body: string, data = {}) {
  try {
    if (!Expo.isExpoPushToken(token)) {
      console.warn('Invalid token', token)
      return false
    }
    const ticket = await expo.sendPushNotificationsAsync([{ to: token, sound: 'default', title, body, data }])
    console.log('Push ticket', ticket)
    return true
  } catch (e) {
    console.error('sendPush failed', e)
    return false
  }
}

// Evaluate rules + windows for a given deal and send pushes to matching users
export async function evaluateAndPush(deal: any) {
  // Implementação temporária sem banco de dados
  // Em um sistema real, você usaria caches em memória ou outro sistema
  console.log('Avaliando e enviando notificação para:', deal)
  
  // Simular envio de notificação para usuários que correspondam aos critérios
  // Em um sistema real, isso seria implementado com um sistema de regras em cache
}