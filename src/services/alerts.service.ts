import { Types } from 'mongoose'
import { Alert } from '../db/models/Alert.js'
import { User } from '../db/models/User.js'
import { Store } from '../db/models/Store.js'
import { Game } from '../db/models/Game.js'
import { sendPush } from './notification.service.js'

export async function registerUser(input: { email: string; pushToken?: string }) {
  const exists = await User.findOne({ email: input.email })
  if (exists) {
    if (input.pushToken) {
      exists.pushToken = input.pushToken
      await exists.save()
    }
    return exists
  }
  return User.create({ email: input.email, pushToken: input.pushToken })
}

export async function createAlert(input: {
  userId: string
  query?: string
  gameId?: string
  maxPrice: number
  stores: string[]
  isActive?: boolean
}) {
  const alert = await Alert.create({
    userId: new Types.ObjectId(input.userId),
    query: input.query,
    gameId: input.gameId ? new Types.ObjectId(input.gameId) : undefined,
    maxPrice: input.maxPrice,
    stores: input.stores,
    isActive: input.isActive ?? true
  })
  return alert
}

export async function getAlertsByUser(userId: string) {
  return Alert.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean()
}

export async function deleteAlert(id: string) {
  await Alert.deleteOne({ _id: new Types.ObjectId(id) })
}

export async function testNotify({ token, title, body }: { token: string; title: string; body: string }) {
  console.log(`🧪 Testando notificação com token: ${token.substring(0, 20)}...`)
  const result = await sendPush(token, title, body, { test: true })
  console.log(`🧪 Resultado do teste de notificação: ${result ? 'SUCESSO' : 'FALHA'}`)
  return result
}

export async function checkAndNotify(gameId: string, offer: { priceFinal: number; discountPct: number; storeId: Types.ObjectId }) {
  const gameRaw = await Game.findById(gameId).lean()
  const game = gameRaw as ({ _id: Types.ObjectId; title: string } | null)
  if (!game) {
    console.log(`⚠️ Jogo não encontrado: ${gameId}`)
    return
  }
  
  const storeRaw = await Store.findById(offer.storeId).lean()
  const store = storeRaw as ({ _id: Types.ObjectId; name: string } | null)
  if (!store) {
    console.log(`⚠️ Loja não encontrada: ${offer.storeId}`)
    return
  }

  console.log(`🔍 Verificando alertas para ${game.title} (${game._id}) - R$ ${offer.priceFinal}`)
  
  const alerts = await Alert.find({ isActive: true, $or: [{ gameId: game._id }, { query: { $exists: true, $ne: null } }] }).lean()
  console.log(`📊 ${alerts.length} alertas encontrados para verificar`)
  
  let notifiedCount = 0
  
  for (const alert of alerts) {
    const storeOk = alert.stores.includes(store.name)
    const priceOk = offer.priceFinal <= alert.maxPrice
    const textOk = alert.gameId ? String(alert.gameId) === String(game._id) : (alert.query ? game.title.toLowerCase().includes(alert.query.toLowerCase()) : false)
    
    console.log(`📊 Verificando alerta ${alert._id} - storeOk: ${storeOk}, priceOk: ${priceOk}, textOk: ${textOk}`)
    
    if (storeOk && priceOk && textOk) {
      console.log(`🎯 Alerta ${alert._id} correspondeu! Enviando notificação...`)
      const userRaw = await User.findById(alert.userId).lean()
      const user = userRaw as ({ pushToken?: string } | null)
      
      if (user?.pushToken) {
        console.log(`📤 Enviando notificação para usuário ${alert.userId} com token: ${user.pushToken.substring(0, 20)}...`)
        const success = await sendPush(user.pushToken, 'Looton: oferta atingiu preço', `${game.title} por R$ ${offer.priceFinal} na ${store.name}`, { 
          gameId: game._id.toString(), 
          offerId: `${offer.storeId}_${gameId}`,
          type: 'price_alert' 
        })
        
        if (success) {
          notifiedCount++
          console.log(`✅ Notificação enviada com sucesso para usuário ${alert.userId}`)
        } else {
          console.log(`❌ Falha ao enviar notificação para usuário ${alert.userId}`)
          
          // Talvez o token seja inválido, vamos verificar com Expo
          try {
            const ExpoSDK = (await import('expo-server-sdk')).Expo
            const expo = new ExpoSDK()
            if (!ExpoSDK.isExpoPushToken(user.pushToken)) {
              console.log(`🗑️ Token inválido detectado para usuário ${alert.userId}, removendo...`)
              // Aqui você poderia atualizar o usuário removendo o token inválido
              await User.findByIdAndUpdate(alert.userId, { $unset: { pushToken: "" } })
            }
          } catch (validationError) {
            console.error('Erro ao validar token:', validationError)
          }
        }
      } else {
        console.log(`⚠️ Usuário ${alert.userId} não tem pushToken ou não foi encontrado`)
      }
    }
  }
  
  console.log(`📊 Total de notificações enviadas: ${notifiedCount}`)
}
