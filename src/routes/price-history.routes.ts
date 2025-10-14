import { FastifyPluginAsync } from 'fastify'
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

// Função para buscar dados atuais da Steam API
async function fetchSteamAppDetails(appId: string) {
  try {
    const response = await fetchWithTimeout(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese&filters=price_overview`, {}, 10000) // 10 segundos
    const data = await response.json()
    
    if (data[appId] && data[appId].success && data[appId].data?.price_overview) {
      const priceData = data[appId].data.price_overview
      return {
        success: true,
        price: priceData.final / 100, // Steam retorna em centavos
        originalPrice: priceData.initial / 100,
        discountPct: priceData.discount_percent,
        currency: priceData.currency
      }
    }
    
    return { success: false }
  } catch (error) {
    console.error('Erro ao buscar dados da Steam:', error)
    return { success: false }
  }
}

// Dados reais da Steam API - sem simulação

const priceHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/price-history/:gameId', async (req, reply) => {
    try {
      const { gameId } = req.params as { gameId: string }
      
      console.log(`Buscando dados REAIS da Steam para appId: ${gameId}`)
      
      // Buscar dados atuais reais da Steam
      const steamData = await fetchSteamAppDetails(gameId)
      
      if (!steamData.success || !steamData.price) {
        return reply.status(404).send({
          error: 'Dados não encontrados',
          message: 'Não foi possível obter dados atuais da Steam para este jogo'
        })
      }
      
      // Retornar APENAS dados reais da Steam (sem simulação)
      const currentDate = new Date().toISOString().split('T')[0]
      const realHistoryData = [{
        date: currentDate,
        prices: {
          steam: steamData.price
        }
      }]
      
      return reply.send({
        gameId,
        gameTitle: `Jogo ${gameId}`,
        period: 'Dados atuais da Steam',
        chartData: realHistoryData,
        currentPrices: {
          steam: {
            price: steamData.price,
            originalPrice: steamData.originalPrice,
            discountPct: steamData.discountPct,
            currency: steamData.currency
          }
        },
        statistics: {
          lowest: steamData.price, // Apenas preço atual disponível
          highest: steamData.originalPrice || steamData.price,
          average: steamData.price,
          currentVsPeak: steamData.discountPct,
          bestStoreCurrent: 'Steam'
        },
        alerts: {
          isBestPriceEver: steamData.discountPct > 0,
          bestPriceAlert: steamData.discountPct > 0 
            ? `🔥 ${steamData.discountPct}% de desconto! Preço atual: R$ ${steamData.price.toFixed(2)}` 
            : `💰 Preço atual da Steam: R$ ${steamData.price.toFixed(2)}`
        },
        notice: 'Dados obtidos DIRETAMENTE da Steam API em tempo real. Steam não oferece API pública de histórico completo.'
      })
      
    } catch (error) {
      console.error('Erro ao buscar dados da Steam:', error)
      return reply.status(500).send({ 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    }
  })
}

export default priceHistoryRoutes