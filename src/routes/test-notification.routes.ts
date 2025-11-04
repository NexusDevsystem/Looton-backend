import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'

const expo = new Expo()

export default async function testNotificationRoutes(app: FastifyInstance) {
  // POST /test-notification - Envia notificação de teste IMEDIATAMENTE
  app.post('/test-notification', async (req: any, reply: any) => {
    console.log('🧪 [TEST] Endpoint de teste de notificação chamado')
    
    const schema = z.object({
      pushToken: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
    })

    try {
      const data = schema.parse(req.body)
      
      // Validar se é um token válido do Expo
      if (!Expo.isExpoPushToken(data.pushToken)) {
        return reply.status(400).send({
          success: false,
          error: 'Push token inválido. Deve ser um ExponentPushToken[...]'
        })
      }

      const message: ExpoPushMessage = {
        to: data.pushToken,
        sound: 'default',
        title: data.title || '🎮 Notificação de Teste',
        body: data.body || 'Esta é uma notificação de teste do Looton! Se você está vendo isso, as notificações estão funcionando! 🎉',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        },
        priority: 'high',
        channelId: 'default',
      }

      console.log('📤 Enviando notificação de teste...')
      console.log('📱 Token:', data.pushToken.substring(0, 30) + '...')

      // Enviar notificação
      const ticketChunk = await expo.sendPushNotificationsAsync([message])
      
      console.log('📬 Resposta do Expo:', JSON.stringify(ticketChunk, null, 2))

      if (ticketChunk[0].status === 'ok') {
        console.log('✅ Notificação enviada com sucesso!')
        return reply.send({
          success: true,
          message: 'Notificação enviada! Verifique seu celular.',
          ticket: ticketChunk[0]
        })
      } else {
        console.error('❌ Erro ao enviar:', ticketChunk[0])
        return reply.status(500).send({
          success: false,
          error: 'Erro ao enviar notificação',
          details: ticketChunk[0]
        })
      }

    } catch (error: any) {
      console.error('❌ Erro no endpoint de teste:', error)
      return reply.status(400).send({
        success: false,
        error: error.message
      })
    }
  })

  // POST /test-notification-simple - Versão ainda mais simples (só precisa do token)
  app.post('/test-notification-simple', async (req: any, reply: any) => {
    console.log('🧪 [TEST SIMPLE] Notificação de teste simples')
    console.log('📊 Enviando APENAS 1 notificação...')
    
    const schema = z.object({
      token: z.string()
    })

    try {
      const { token } = schema.parse(req.body)
      
      if (!Expo.isExpoPushToken(token)) {
        return reply.status(400).send({ error: 'Token inválido' })
      }

      // 🔥 IMPORTANTE: Envia APENAS 1 notificação
      const message: ExpoPushMessage = {
        to: token,
        sound: 'default',
        title: '🎮 Looton - Teste',
        body: '🔥 Esta é UMA notificação de teste!',
        priority: 'high',
        channelId: 'default',
      }

      console.log('📤 Enviando 1 notificação para:', token.substring(0, 30) + '...')
      const tickets = await expo.sendPushNotificationsAsync([message])
      console.log('✅ Total enviado: 1 notificação')
      
      return reply.send({
        success: true,
        message: 'Notificação enviada!',
        status: tickets[0].status,
        totalSent: 1
      })

    } catch (error: any) {
      return reply.status(400).send({ error: error.message })
    }
  })

  // GET /test-notification-info - Informações sobre como testar
  app.get('/test-notification-info', async (req: any, reply: any) => {
    return reply.send({
      message: 'Endpoint de teste de notificações',
      howToUse: {
        step1: 'Abra o app no celular e copie o push token',
        step2: 'Faça um POST para /test-notification com { "pushToken": "seu-token-aqui" }',
        step3: 'Veja a notificação aparecer no seu Android!'
      },
      endpoints: [
        {
          method: 'POST',
          path: '/test-notification',
          body: {
            pushToken: 'ExponentPushToken[xxx...]',
            title: 'Título opcional',
            body: 'Mensagem opcional'
          }
        },
        {
          method: 'POST',
          path: '/test-notification-simple',
          body: {
            token: 'ExponentPushToken[xxx...]'
          }
        }
      ]
    })
  })
}
