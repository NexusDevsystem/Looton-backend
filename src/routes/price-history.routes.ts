import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendBestPriceNotification, addUserPushToken, removeUserPushToken } from '../services/push-notifications.service.js'

// Simulação de dados de histórico - em produção viria do banco
const priceHistory = new Map<string, Array<{
  price: number
  date: string  
  store: string
  gameTitle?: string
}>>()

// Fila de notificações de melhor preço
const bestPriceAlerts = new Map<string, {
  gameId: string
  gameTitle: string
  currentPrice: number
  previousBest: number
  store: string
  timestamp: string
}>()

function isBestPriceEver(gameId: string, newPrice: number): boolean {
  const history = priceHistory.get(gameId) || []
  const allPrices = history.map(h => h.price)
  
  if (allPrices.length === 0) return true
  
  const currentBest = Math.min(...allPrices)
  return newPrice < currentBest
}

function calculatePriceStats(history: Array<{price: number, date: string, store: string}>) {
  if (history.length === 0) return null
  
  const prices = history.map(h => h.price)
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  const average = prices.reduce((a, b) => a + b, 0) / prices.length
  
  const lowestEntry = history.find(h => h.price === lowest)
  
  return {
    lowest,
    highest,
    average: Math.round(average * 100) / 100,
    lowestDate: lowestEntry?.date,
    lowestStore: lowestEntry?.store,
    dataPoints: prices.length
  }
}

export default async function priceHistoryRoutes(app: FastifyInstance) {
  // GET /price-history/:gameId - Histórico completo do jogo
  app.get('/price-history/:gameId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          gameId: { type: 'string' }
        },
        required: ['gameId']
      },
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', minimum: 1, maximum: 365, default: 90 }
        }
      }
    }
  }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string }
    const { days = 90 } = request.query as { days?: number }
    
    // Buscar histórico (simulado por agora)
    let history = priceHistory.get(gameId) || []
    
    // Se não tem histórico, gerar dados de exemplo realistas
    if (history.length === 0 && gameId) {
      const basePrice = Math.floor(Math.random() * 80) + 20
      const stores = ['steam', 'epic', 'gog']
      const gameTitle = `Game ${gameId}`
      
      // Gerar histórico dos últimos 6 meses
      for (let i = 180; i >= 0; i -= 3) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        
        stores.forEach(storeName => {
          const daysSinceStart = 180 - i
          const trendFactor = Math.sin(daysSinceStart * 0.1) * 10
          const randomVariation = (Math.random() - 0.5) * 15
          
          let price = basePrice + trendFactor + randomVariation
          
          // Ofertas especiais ocasionais
          if (Math.random() < 0.1) {
            price = price * 0.6
          }
          
          price = Math.max(5, Math.round(price * 100) / 100)
          
          history.push({
            price,
            date: date.toISOString().split('T')[0],
            store: storeName,
            gameTitle
          })
        })
      }
      
      priceHistory.set(gameId, history)
    }
    
    // Filtrar por período
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const filteredHistory = history.filter(entry => 
      new Date(entry.date) >= cutoffDate
    )
    
    // Agrupar por data
    const groupedByDate = filteredHistory.reduce((acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = {}
      }
      acc[entry.date][entry.store] = entry.price
      return acc
    }, {} as Record<string, Record<string, number>>)
    
    const chartData = Object.entries(groupedByDate)
      .map(([date, stores]) => ({
        date,
        prices: stores
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    // Calcular estatísticas
    const stats = calculatePriceStats(filteredHistory)
    
    // Preços atuais (mais recentes)
    const latestEntries = history
      .filter(h => new Date(h.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .sort((a, b) => b.date.localeCompare(a.date))
    
    const currentPrices = latestEntries.reduce((acc, entry) => {
      if (!acc[entry.store] || new Date(entry.date) > new Date(acc[entry.store].date)) {
        acc[entry.store] = { price: entry.price, date: entry.date }
      }
      return acc
    }, {} as Record<string, {price: number, date: string}>)
    
    return reply.send({
      gameId,
      gameTitle: history[0]?.gameTitle || `Game ${gameId}`,  
      period: `${days} days`,
      chartData,
      currentPrices,
      statistics: stats,
      alerts: {
        isBestPriceEver: stats ? Object.values(currentPrices).some(cp => cp.price <= stats.lowest) : false,
        bestPriceAlert: bestPriceAlerts.get(gameId) || null
      }
    })
  })
  
  // POST /price-history/:gameId - Adicionar nova entrada de preço
  app.post('/price-history/:gameId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          gameId: { type: 'string' }
        },
        required: ['gameId']
      },
      body: {
        type: 'object',
        properties: {
          price: { type: 'number', minimum: 0 },
          store: { type: 'string' },
          gameTitle: { type: 'string' },
          date: { type: 'string', format: 'date' }
        },
        required: ['price', 'store', 'gameTitle']
      }
    }
  }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string }
    const { price, store, gameTitle, date = new Date().toISOString().split('T')[0] } = request.body as {
      price: number
      store: string
      gameTitle: string
      date?: string
    }
    
    if (!priceHistory.has(gameId)) {
      priceHistory.set(gameId, [])
    }
    
    // Verificar se é o melhor preço histórico ANTES de adicionar
    const isBestPrice = isBestPriceEver(gameId, price)
    
    const history = priceHistory.get(gameId)!
    history.push({ price, store, date, gameTitle })
    
    // Manter apenas os últimos 2 anos
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 730)
    
    const filtered = history.filter(entry => new Date(entry.date) >= cutoff)
    priceHistory.set(gameId, filtered)
    
    // Se é o melhor preço, criar alerta e enviar notificação
    if (isBestPrice) {
      const previousBest = history.length > 1 
        ? Math.min(...history.slice(0, -1).map(h => h.price))
        : price + 10
        
      bestPriceAlerts.set(gameId, {
        gameId,
        gameTitle,
        currentPrice: price,
        previousBest,
        store,
        timestamp: new Date().toISOString()
      })
      
      console.log(`🔥 MELHOR PREÇO HISTÓRICO: ${gameTitle} por ${price} na ${store}!`)
      
      // Enviar notificação push
      try {
        await sendBestPriceNotification({
          gameId,
          gameTitle,
          price,
          store,
          previousBest
        })
      } catch (error) {
        console.error('Erro ao enviar notificação:', error)
      }
    }
    
    return reply.code(201).send({ 
      success: true, 
      message: 'Price history entry added',
      gameId,
      entry: { price, store, date, gameTitle },
      isBestPriceEver: isBestPrice
    })
  })
  
  // GET /best-price-alerts - Obter alertas de melhor preço
  app.get('/best-price-alerts', async (request, reply) => {
    const alerts = Array.from(bestPriceAlerts.values())
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    
    return reply.send({
      alerts,
      count: alerts.length
    })
  })
  
  // DELETE /best-price-alerts/:gameId - Marcar alerta como lido
  app.delete('/best-price-alerts/:gameId', async (request, reply) => {
    const { gameId } = request.params as { gameId: string }
    
    const existed = bestPriceAlerts.has(gameId)
    bestPriceAlerts.delete(gameId)
    
    return reply.send({
      success: true,
      message: existed ? 'Alert dismissed' : 'Alert not found'
    })
  })
  
  // POST /push-token - Registrar token de push do usuário
  app.post('/push-token', {
    schema: {
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        },
        required: ['token']
      }
    }
  }, async (request, reply) => {
    const { token } = request.body as { token: string }
    
    const success = addUserPushToken(token)
    
    return reply.send({
      success,
      message: success ? 'Push token registered' : 'Invalid push token'
    })
  })
  
  // DELETE /push-token - Remover token de push do usuário
  app.delete('/push-token', {
    schema: {
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        },
        required: ['token']
      }
    }
  }, async (request, reply) => {
    const { token } = request.body as { token: string }
    
    const removed = removeUserPushToken(token)
    
    return reply.send({
      success: true,
      message: removed ? 'Push token removed' : 'Token not found'
    })
  })
}