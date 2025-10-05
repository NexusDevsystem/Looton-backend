import { fetchSteamAppPrice } from './steam-api.service.js'

export interface PricePoint {
  date: string
  price: number
  originalPrice: number
  discountPct: number
}

export interface StorePriceHistory {
  steam?: PricePoint[]
  epic?: PricePoint[]
}

export interface PriceHistoryResponse {
  gameId: string
  gameTitle: string
  period: string
  chartData: {
    date: string
    prices: {
      steam?: number
      epic?: number
    }
  }[]
  currentPrices: {
    steam?: {
      price: number
      originalPrice: number
      discountPct: number
      currency: string
    }
    epic?: {
      price: number
      originalPrice: number
      discountPct: number
      currency: string
    }
  }
  statistics: {
    lowestPrice: number
    highestPrice: number
    averagePrice: number
    currentVsPeak: number
    bestStoreCurrent: string
  } | null
  alerts: {
    isBestPriceEver: boolean
    bestPriceAlert: string | null
  }
}

// Simulated historical data for Steam (since Steam doesn't provide historical prices via API)
function generateSteamPriceHistory(currentPrice: number, originalPrice: number, days: number = 30): PricePoint[] {
  const history: PricePoint[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // Simulate price variations (real historical data would come from price tracking service)
    const variation = Math.random() * 0.3 - 0.15 // ±15% variation
    const dayPrice = Math.max(currentPrice * (1 + variation), currentPrice * 0.5) // Never below 50% of current
    const dayOriginal = Math.max(originalPrice * (1 + variation * 0.5), dayPrice) // Original price variation
    const dayDiscount = dayOriginal > dayPrice ? Math.round(((dayOriginal - dayPrice) / dayOriginal) * 100) : 0
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(dayPrice * 100) / 100,
      originalPrice: Math.round(dayOriginal * 100) / 100,
      discountPct: dayDiscount
    })
  }
  
  return history
}

// Similar for Epic Games (also simulated since Epic doesn't provide historical data)
function generateEpicPriceHistory(currentPrice: number, originalPrice: number, days: number = 30): PricePoint[] {
  const history: PricePoint[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // Epic often has different pricing strategies
    const variation = Math.random() * 0.4 - 0.2 // ±20% variation
    const dayPrice = Math.max(currentPrice * (1 + variation), currentPrice * 0.3) // Can go lower (Epic sales)
    const dayOriginal = Math.max(originalPrice * (1 + variation * 0.3), dayPrice)
    const dayDiscount = dayOriginal > dayPrice ? Math.round(((dayOriginal - dayPrice) / dayOriginal) * 100) : 0
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(dayPrice * 100) / 100,
      originalPrice: Math.round(dayOriginal * 100) / 100,
      discountPct: dayDiscount
    })
  }
  
  return history
}

export async function fetchPriceHistoryData(gameId: string, days: number = 30): Promise<PriceHistoryResponse> {
  try {
    // Try to fetch current prices from both stores
    let steamData: any = null
    let epicData: any = null
    let gameTitle = `Game ${gameId}`
    
    // Fetch Steam data if gameId is numeric (Steam App ID)
    const numericGameId = parseInt(gameId)
    if (!isNaN(numericGameId)) {
      try {
        steamData = await fetchSteamAppPrice(numericGameId)
        if (steamData) {
          gameTitle = steamData.title
        }
      } catch (err) {
        console.warn(`Could not fetch Steam data for ${gameId}:`, err)
      }
    }
    
    // For Epic, we would need a different approach since Epic IDs are not numeric
    // For now, we'll simulate Epic data if it's a known Epic game
    const knownEpicGames: Record<string, { title: string, price: number, originalPrice: number }> = {
      'fortnite': { title: 'Fortnite', price: 0, originalPrice: 0 },
      'gta5': { title: 'Grand Theft Auto V', price: 49.99, originalPrice: 99.99 },
      'cyberpunk-2077': { title: 'Cyberpunk 2077', price: 79.99, originalPrice: 199.99 },
      'fall-guys': { title: 'Fall Guys', price: 0, originalPrice: 0 },
    }
    
    if (knownEpicGames[gameId]) {
      epicData = knownEpicGames[gameId]
      gameTitle = epicData.title
    }
    
    // Generate price history
    const steamHistory = steamData ? generateSteamPriceHistory(
      steamData.priceFinalCents / 100,
      steamData.priceBaseCents / 100,
      days
    ) : null
    
    const epicHistory = epicData ? generateEpicPriceHistory(
      epicData.price,
      epicData.originalPrice,
      days
    ) : null
    
    // Combine into chart data
    const chartData: { date: string, prices: { steam?: number, epic?: number } }[] = []
    const dateSet = new Set<string>()
    
    // Collect all dates
    if (steamHistory) steamHistory.forEach(point => dateSet.add(point.date))
    if (epicHistory) epicHistory.forEach(point => dateSet.add(point.date))
    
    // Create chart data for each date
    Array.from(dateSet).sort().forEach(date => {
      const prices: { steam?: number, epic?: number } = {}
      
      const steamPoint = steamHistory?.find(p => p.date === date)
      const epicPoint = epicHistory?.find(p => p.date === date)
      
      if (steamPoint) prices.steam = steamPoint.price
      if (epicPoint) prices.epic = epicPoint.price
      
      chartData.push({ date, prices })
    })
    
    // Calculate statistics
    const allPrices: number[] = []
    if (steamHistory) allPrices.push(...steamHistory.map(p => p.price))
    if (epicHistory) allPrices.push(...epicHistory.map(p => p.price))
    
    let statistics = null
    if (allPrices.length > 0) {
      const lowestPrice = Math.min(...allPrices)
      const highestPrice = Math.max(...allPrices)
      const averagePrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length
      
      // Current prices
      const currentSteamPrice = steamData ? steamData.priceFinalCents / 100 : null
      const currentEpicPrice = epicData ? epicData.price : null
      const currentBestPrice = Math.min(
        ...[currentSteamPrice, currentEpicPrice].filter(p => p !== null) as number[]
      )
      
      const bestStoreCurrent = currentSteamPrice && currentSteamPrice <= (currentEpicPrice || Infinity) ? 'Steam' : 'Epic Games'
      
      statistics = {
        lowestPrice: Math.round(lowestPrice * 100) / 100,
        highestPrice: Math.round(highestPrice * 100) / 100,
        averagePrice: Math.round(averagePrice * 100) / 100,
        currentVsPeak: Math.round(((currentBestPrice - highestPrice) / highestPrice) * 100),
        bestStoreCurrent
      }
    }
    
    // Current prices info
    const currentPrices: any = {}
    if (steamData) {
      currentPrices.steam = {
        price: steamData.priceFinalCents / 100,
        originalPrice: steamData.priceBaseCents / 100,
        discountPct: steamData.discountPct,
        currency: steamData.currency
      }
    }
    if (epicData) {
      currentPrices.epic = {
        price: epicData.price,
        originalPrice: epicData.originalPrice,
        discountPct: epicData.originalPrice > epicData.price ? 
          Math.round(((epicData.originalPrice - epicData.price) / epicData.originalPrice) * 100) : 0,
        currency: 'BRL'
      }
    }
    
    // Alerts
    const isBestPriceEver = statistics ? 
      (currentPrices.steam?.price === statistics.lowestPrice || currentPrices.epic?.price === statistics.lowestPrice) : false
    
    return {
      gameId,
      gameTitle,
      period: `${days} days`,
      chartData,
      currentPrices,
      statistics,
      alerts: {
        isBestPriceEver,
        bestPriceAlert: isBestPriceEver ? 'Este é o menor preço já registrado!' : null
      }
    }
  } catch (error) {
    console.error('Error fetching price history:', error)
    throw error
  }
}