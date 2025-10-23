import axios from 'axios'

interface SteamGenre {
  id: string
  description: string
}

interface SteamAppDetailsResponse {
  [appId: string]: {
    success: boolean
    data?: {
      genres?: SteamGenre[]
      [key: string]: any
    }
  }
}

/**
 * Busca gêneros oficiais da Steam para um appId específico
 */
export async function fetchSteamGenres(appId: number): Promise<{ id: string; name: string }[]> {
  try {
    const response = await axios.get<SteamAppDetailsResponse>(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese&filters=genres`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Looton/1.0'
        }
      }
    )

    const appData = response.data[appId.toString()]
    
    if (!appData?.success || !appData.data?.genres) {
      return []
    }

    return appData.data.genres.map(genre => ({
      id: String(genre.id),
      name: String(genre.description)
    }))

  } catch (error) {
    console.error(`Erro ao buscar gêneros Steam para appId ${appId}:`, error)
    return []
  }
}

/**
 * Converte gêneros Steam para slugs indexáveis
 */
export function toGenreSlugs(steamGenres: { id: string; name: string }[]): string[] {
  return steamGenres.map(genre => {
    const slug = genre.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    return `${genre.id}:${slug}`
  })
}

/**
 * Atualiza gêneros Steam de um jogo específico
 */
export async function upsertGameGenresFromSteam(appId: number): Promise<void> {
  try {
    const steamGenres = await fetchSteamGenres(appId)
    
    if (steamGenres.length === 0) {
      console.log(`Nenhum gênero encontrado para Steam appId ${appId}`)
      return
    }

    const genreSlugs = toGenreSlugs(steamGenres)

    // Implementação temporária sem banco de dados
    // Em um sistema real, você usaria um cache em memória ou outro sistema
    console.log(`Gêneros a serem atualizados para Steam appId ${appId}: ${steamGenres.map(g => g.name).join(', ')}`)

    console.log(`Gêneros atualizados para Steam appId ${appId}: ${steamGenres.map(g => g.name).join(', ')} (mock)`)

  } catch (error) {
    console.error(`Erro ao atualizar gêneros para Steam appId ${appId}:`, error)
  }
}

/**
 * Atualiza gêneros Steam em lote para múltiplos jogos
 */
export async function batchUpdateSteamGenres(appIds: number[], batchSize = 10, delayMs = 1000): Promise<void> {
  console.log(`Iniciando atualização em lote de gêneros Steam para ${appIds.length} jogos`)

  for (let i = 0; i < appIds.length; i += batchSize) {
    const batch = appIds.slice(i, i + batchSize)
    
    console.log(`Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(appIds.length / batchSize)}`)

    const promises = batch.map(appId => upsertGameGenresFromSteam(appId))
    await Promise.allSettled(promises)

    // Delay entre lotes para não sobrecarregar a API da Steam
    if (i + batchSize < appIds.length) {
      console.log(`Aguardando ${delayMs}ms antes do próximo lote...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log('Atualização em lote de gêneros Steam concluída')
}

/**
 * Retorna todos os gêneros Steam únicos presentes no banco
 */
export async function getAvailableSteamGenres(): Promise<{ id: string; name: string }[]> {
  try {
    // Implementação temporária sem banco de dados
    // Em um sistema real, você usaria um cache em memória ou outro sistema
    
    // Simular resultados
    const mockGenres = [
      { id: '1', name: 'Ação' },
      { id: '2', name: 'Aventura' },
      { id: '3', name: 'Indie' },
      { id: '4', name: 'RPG' },
      { id: '5', name: 'Simulação' },
      { id: '6', name: 'Estratégia' }
    ]

    return mockGenres
  } catch (error) {
    console.error('Erro ao buscar gêneros Steam disponíveis:', error)
    return []
  }
}