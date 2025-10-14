import { Expo } from 'expo-server-sdk'
import * as admin from 'firebase-admin'
import { NotificationRule } from '../db/models/NotificationRule.js'
import { PriceWindow } from '../db/models/PriceWindow.js'
import { User } from '../db/models/User.js'
import { Mute } from '../db/models/Mute.js'

const expo = new Expo()

export async function sendPush(token: string, title: string, body: string, data = {}) {
  let expoSuccess = false;
  let firebaseSuccess = false;
  
  console.log(`📤 Tentando enviar push para token: ${token.substring(0, 20)}...`)
  
  // Tentar enviar via Expo primeiro (se for token Expo)
  if (Expo.isExpoPushToken(token)) {
    try {
      const messages = [{
        to: token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high' as const // Garantir prioridade alta para notificações
      }]
      
      const ticket = await expo.sendPushNotificationsAsync(messages)
      console.log('📨 Push ticket do Expo enviado:', ticket)
      
      // Verificar se houve erro no envio
      if (ticket && Array.isArray(ticket) && ticket[0] && ticket[0].status === 'error') {
        console.error('❌ Erro no envio da notificação via Expo:', ticket[0].details)
      } else {
        expoSuccess = true
        console.log('✅ Notificação via Expo enviada com sucesso')
      }
    } catch (expoError) {
      console.error('❌ Erro ao enviar notificação via Expo:', expoError)
    }
  } else {
    console.log('⚠️ Token não é válido para Expo')
  }
  
  // Tentar enviar via Firebase também (se for um token FCM)
  // Tokens FCM geralmente são mais longos e podem ter formato específico
  if (token.startsWith('fcm') || token.length > 100 || token.includes('APA91') || token.includes('cAma')) {
    try {
      // Inicializar o Firebase Admin SDK se ainda não estiver inicializado
      if (admin.apps.length === 0) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
          const serviceAccount = await import(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else {
          console.log('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH não definido - não é possível enviar via Firebase');
          // Nesse caso, podemos retornar baseado no sucesso do Expo apenas
          return expoSuccess;
        }
      }
  
      const message = {
        token: token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          title, // Incluir título nos dados para quando a notificação for recebida em segundo plano
          body,  // Incluir corpo nos dados
        },
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'default', // Canal padrão para Android
          },
        },
      };
  
      const response = await admin.messaging().send(message);
      console.log('📨 Notificação via Firebase enviada com ID:', response);
      firebaseSuccess = true;
    } catch (firebaseError: unknown) {
      console.error('❌ Erro ao enviar notificação via Firebase:', (firebaseError as any)?.message || firebaseError);
      // Se o token for inválido, podemos tentar remover do usuário
      if ((firebaseError as any)?.code?.includes('registration-token') || 
          (firebaseError as any)?.code?.includes('not-found')) {
        console.log('🗑️ Token FCM inválido detectado, considerar remoção do usuário');
      }
    }
  }
  
  // Considerar o envio bem-sucedido se pelo menos um dos serviços funcionar
  const success = expoSuccess || firebaseSuccess;
  
  if (success) {
    console.log('✅ Notificação enviada com sucesso (pelo menos um serviço funcionou)');
  } else {
    console.log('❌ Falha no envio da notificação (ambos os serviços falharam)');
  }
  
  return success;
}

// Evaluate rules + windows for a given deal and send pushes to matching users
export async function evaluateAndPush(deal: any) {
  console.log(`🔍 Avaliando notificações para oferta: ${deal.game?.title} - ${deal.priceFinal} (${deal.discountPct}% off)`)
  
  // naive implementation: find all rules and windows that match and notify their users
  const rules = await NotificationRule.find({ enabled: true }).lean()
  const windows = await PriceWindow.find({ enabled: true }).lean()

  // simple matching
  const matches: Record<string, { userId: string; reasons: string[] }> = {}

  for (const r of rules) {
    const q = (r.query || '').toLowerCase()
    const dev = (deal.game?.developer || '').toLowerCase()
    if (r.type === 'studio' && dev.includes(q)) {
      matches[String(r.userId)] = matches[String(r.userId)] || { userId: String(r.userId), reasons: [] }
      matches[String(r.userId)].reasons.push(`studio:${r.query}`)
      console.log(`🎯 Regra de estúdio encontrada para usuário ${r.userId}: ${r.query}`)
    }
    if (r.type === 'game' && (deal.game?.title || '').toLowerCase().includes(q)) {
      matches[String(r.userId)] = matches[String(r.userId)] || { userId: String(r.userId), reasons: [] }
      matches[String(r.userId)].reasons.push(`game:${r.query}`)
      console.log(`🎯 Regra de jogo encontrada para usuário ${r.userId}: ${r.query}`)
    }
  }

  for (const w of windows) {
    const p = deal.priceFinal
    if ((w.min === undefined || p >= w.min) && (w.max === undefined || p <= w.max)) {
      matches[String(w.userId)] = matches[String(w.userId)] || { userId: String(w.userId), reasons: [] }
      matches[String(w.userId)].reasons.push(`price:${w.min || '-'}-${w.max || '-'}`)
      console.log(`🎯 Janela de preço encontrada para usuário ${w.userId}: ${w.min || '-'}-${w.max || '-'}`)
    }
  }

  // now notify users (respecting mutes)
  let notifiedUsers = 0
  for (const k of Object.keys(matches)) {
    try {
      const u = await User.findById(k).lean()
      if (!u || !u.pushToken) {
        console.log(`⚠️ Usuário ${k} não encontrado ou não tem pushToken`)
        continue
      }
      
      // check mutes
      const mute = await Mute.findOne({ userId: k, targetType: 'game', targetId: String(deal.appId || deal._id), until: { $gt: new Date() } }).lean()
      if (mute) {
        console.log(`🔇 Usuário ${k} tem mute ativo para este jogo`)
        continue
      }

      const title = `Oferta: ${deal.game?.title}`
      const body = `${deal.store?.name} — ${deal.priceFinal} (${Math.round(deal.discountPct || 0)}% off)`
      
      console.log(`📤 Enviando notificação para usuário ${k}: ${title} - ${body}`)
      const success = await sendPush(u.pushToken, title, body, { 
        dealId: deal._id,
        dealUrl: deal.url,
        type: 'deal_notification'
      })
      
      if (success) {
        notifiedUsers++
        console.log(`✅ Notificação enviada com sucesso para usuário ${k}`)
      } else {
        console.log(`❌ Falha ao enviar notificação para usuário ${k}`)
      }
    } catch (e) {
      console.warn('evaluateAndPush user notify error', e)
    }
  }
  
  console.log(`📊 Total de usuários notificados: ${notifiedUsers}`)
}

// Nova função para detectar e notificar preços históricos
export async function evaluateHistoricalPrices(deal: any, gameHistory: any[]) {
  if (!gameHistory || gameHistory.length === 0) {
    console.log(`📊 Sem histórico para avaliar preços históricos de ${deal.game?.title}`)
    return
  }

  // Calcular estatísticas do histórico
  const prices = gameHistory.map(h => h.priceFinal)
  const lowestPrice = Math.min(...prices)
  const highestPrice = Math.max(...prices)
  const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length

  console.log(`📊 Estatísticas de preço para ${deal.game?.title}: lowest=${lowestPrice}, current=${deal.priceFinal}, average=${averagePrice.toFixed(2)}`)

  // Verificar se é um preço histórico baixo
  const isHistoricalLow = deal.priceFinal <= lowestPrice
  const isSignificantlyLow = deal.priceFinal < averagePrice * 0.7 // Preço 30% abaixo da média

  if (isHistoricalLow || isSignificantlyLow) {
    console.log(`🎯 Detectado preço histórico baixo para ${deal.game?.title}: ${deal.priceFinal}`)
    
    // Encontrar usuários que podem estar interessados
    const interestedUsers = await User.find({ 
      pushToken: { $exists: true, $ne: null },
      preferences: { 
        $or: [
          { preferredSteamGenreIds: { $in: deal.game?.genres || [] } },
          { preferredSteamGenreIds: { $size: 0 } } // Usuários sem preferências específicas
        ]
      }
    }).lean()

    for (const user of interestedUsers) {
      try {
        const title = isHistoricalLow ? 
          `🏆 Preço Histórico Baixo!` : 
          `💰 Grande Oferta Detectada!`
        
        const body = `${deal.game?.title} está a R$ ${deal.priceFinal} na ${deal.store?.name} - ${Math.round(deal.discountPct || 0)}% off!`
        
        console.log(`📤 Enviando notificação de preço histórico para usuário ${user._id}`)
        await sendPush(user.pushToken!, title, body, { 
          dealId: deal._id,
          dealUrl: deal.url,
          type: 'historical_price',
          isHistoricalLow
        })
      } catch (e) {
        console.warn('Erro ao notificar usuário sobre preço histórico', e)
      }
    }
  }
}
