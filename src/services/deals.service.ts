export interface DealResponse {
  gameId: string
  title: string
  steamGenres: Array<{ id: string; name: string }>
  coverUrl?: string
  store: string
  url: string
  priceFinalCents: number
  priceBaseCents: number
  discountPct: number
  isBest: boolean
  lastSeenAt: Date
  score?: number
}

/**
 * Busca ofertas com priorização baseada nas preferências do usuário
 */
export async function fetchDealsBoosted(userId: string, limit = 40): Promise<DealResponse[]> {
  try {
    // Implementação temporária sem banco de dados
    // Em um sistema real, você usaria um cache em memória ou outro sistema
    
    // Simular preferências do usuário
    const mockPrefs = { 
      preferredSteamGenreIds: ['1', '2'], // Ação e Aventura como padrão
      minDiscount: 10, 
      stores: [] 
    }
    
    const prefIds = mockPrefs.preferredSteamGenreIds
    const minDiscount = mockPrefs.minDiscount

    console.log(`Buscando deals boosted para usuário ${userId} (mock):`, {
      preferredGenres: prefIds,
      minDiscount
    })

    // Simular resultados
    const mockResults: DealResponse[] = [
      {
        gameId: 'game_1',
        title: 'Jogo Exemplo 1',
        steamGenres: [{ id: '1', name: 'Ação' }, { id: '2', name: 'Aventura' }],
        coverUrl: 'https://example.com/cover1.jpg',
        store: 'Exemplo Store',
        url: 'https://example.com/game1',
        priceFinalCents: 5000,
        priceBaseCents: 10000,
        discountPct: 50,
        isBest: true,
        lastSeenAt: new Date(),
        score: 100
      },
      {
        gameId: 'game_2',
        title: 'Jogo Exemplo 2',
        steamGenres: [{ id: '7', name: 'RPG' }],
        coverUrl: 'https://example.com/cover2.jpg',
        store: 'Exemplo Store',
        url: 'https://example.com/game2',
        priceFinalCents: 3000,
        priceBaseCents: 6000,
        discountPct: 50,
        isBest: false,
        lastSeenAt: new Date(),
        score: 75
      }
    ]

    console.log(`Encontradas ${mockResults.length} ofertas boosted para usuário ${userId} (mock)`)
    
    // Limitar resultados
    return mockResults.slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar deals boosted:', error)
    throw error
  }
}

/**
 * Busca ofertas sem personalização (ordenação padrão)
 */
export async function fetchDealsDefault(limit = 40): Promise<DealResponse[]> {
  try {
    // Simular resultados
    const mockResults: DealResponse[] = [
      {
        gameId: 'game_1',
        title: 'Jogo Exemplo 1',
        steamGenres: [{ id: '1', name: 'Ação' }],
        coverUrl: 'https://example.com/cover1.jpg',
        store: 'Exemplo Store',
        url: 'https://example.com/game1',
        priceFinalCents: 5000,
        priceBaseCents: 10000,
        discountPct: 50,
        isBest: true,
        lastSeenAt: new Date()
      },
      {
        gameId: 'game_2',
        title: 'Jogo Exemplo 2',
        steamGenres: [{ id: '6', name: 'Corrida' }],
        coverUrl: 'https://example.com/cover2.jpg',
        store: 'Exemplo Store',
        url: 'https://example.com/game2',
        priceFinalCents: 3000,
        priceBaseCents: 6000,
        discountPct: 50,
        isBest: false,
        lastSeenAt: new Date()
      }
    ]

    console.log(`Encontradas ${mockResults.length} ofertas padrão (mock)`)
    
    // Limitar resultados
    return mockResults.slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar deals padrão:', error)
    throw error
  }
}