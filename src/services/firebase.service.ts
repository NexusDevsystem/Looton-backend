import admin from 'firebase-admin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Inicializar Firebase Admin SDK
if (!admin.apps.length) {
  // Tentar primeiro usar variáveis de ambiente (para produção no Render)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    })
    console.log('✅ Firebase Admin inicializado via variáveis de ambiente')
  } else {
    // Fallback: usar arquivo local (para desenvolvimento)
    try {
      const serviceAccount = path.join(__dirname, '../../firebase-admin-key.json')
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('✅ Firebase Admin inicializado via arquivo local')
    } catch (error) {
      console.warn('⚠️ Firebase Admin não inicializado - arquivo de credenciais não encontrado')
    }
  }
}

export const firebaseAdmin = admin

/**
 * Envia notificação push usando Firebase Cloud Messaging (FCM)
 * Mais profissional que Expo Push API
 */
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: any
) {
  try {
    // Extrair FCM token do Expo Push Token format: ExponentPushToken[xxxx]
    // Para Expo SDK 54+, o token já vem no formato correto
    let fcmToken = expoPushToken
    
    // Se for formato antigo ExponentPushToken[xxxx], extrair
    if (expoPushToken.startsWith('ExponentPushToken[')) {
      fcmToken = expoPushToken.slice(18, -1)
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token: fcmToken,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high' as const,
        },
      },
    }

    const response = await firebaseAdmin.messaging().send(message)
    console.log('✅ Push FCM enviado com sucesso:', response)
    return { success: true, messageId: response }
  } catch (error: any) {
    console.error('❌ Erro ao enviar push FCM:', error)
    
    // Fallback: tentar via Expo Push API
    console.log('🔄 Tentando fallback via Expo Push API...')
    try {
      const expoMessage = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        priority: 'high' as const,
        channelId: 'default',
        data: data || {},
      }

      const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(expoMessage),
      })

      const result = await expoResponse.json()
      console.log('✅ Fallback Expo Push API bem-sucedido:', result)
      return { success: true, fallback: true, result }
    } catch (fallbackError) {
      console.error('❌ Fallback também falhou:', fallbackError)
      throw new Error(`FCM e Expo Push falharam: ${error.message}`)
    }
  }
}
