// Utilitário para categorizar jogos por gênero/tag

export type GameCategory = 'racing' | 'fps' | 'survival' | 'sports'

export interface CategoryDefinition {
  name: string
  displayName: string
  keywords: string[] // Palavras-chave em português e inglês
  steamTags: string[] // Tags da Steam
  steamGenres: string[] // Gêneros da Steam
}

// Definição das categorias
export const CATEGORIES: Record<GameCategory, CategoryDefinition> = {
  racing: {
    name: 'racing',
    displayName: 'Corrida',
    keywords: [
      'racing', 'corrida', 'rally', 'formula', 'f1', 'f2', 'nascar', 'drift', 'kart', 'karting',
      'moto', 'motorcycle', 'bike', 'car', 'carro', 'driving', 'driver', 'velocidade', 'speed',
      'forza', 'gran turismo', 'need for speed', 'nfs', 'assetto', 'project cars', 'dirt',
      'wrc', 'motogp', 'superbike', 'truck', 'bus simulator'
    ],
    steamTags: ['Racing', 'Driving', 'Automobile Sim', 'Motorbike', 'Formula 1', 'Rally', 'Drift', 'Motocross', 'Kart'],
    steamGenres: ['Racing', 'Corrida', 'Simulation', 'Simulação']
  },
  fps: {
    name: 'fps',
    displayName: 'FPS',
    keywords: [
      'fps', 'first person', 'primeira pessoa', 'shooter', 'tiro', 'shooting',
      'counter', 'battlefield', 'call of duty', 'cod', 'csgo', 'cs:go', 'valorant',
      'warzone', 'apex', 'overwatch', 'destiny', 'halo', 'doom', 'quake', 'unreal',
      'rainbow six', 'siege', 'hunt showdown', 'tarkov', 'insurgency', 'squad',
      'hell let loose', 'arma', 'war', 'combat', 'military', 'tactical', 'gun'
    ],
    steamTags: ['FPS', 'Shooter', 'First-Person', 'Tactical', 'Hero Shooter', 'Military', 'War', 'PvP', 'Multiplayer'],
    steamGenres: ['Action', 'FPS', 'Ação', 'Shooter']
  },
  survival: {
    name: 'survival',
    displayName: 'Sobrevivência',
    keywords: [
      'survival', 'sobrevivência', 'sobrevivencia', 'sobreviver', 'survive',
      'crafting', 'craft', 'zombie', 'zumbi', 'apocalipse', 'apocalypse', 'apocalíptico',
      'rust', 'ark', 'conan', 'dayz', 'forest', 'subnautica', 'raft', 'valheim',
      'dont starve', 'green hell', 'stranded', 'minecraft', 'terraria', 'base building',
      'hunger', 'fome', 'sede', 'thirst', 'recursos', 'resources', 'sandbox'
    ],
    steamTags: ['Survival', 'Survival Horror', 'Crafting', 'Zombies', 'Post-apocalyptic', 'Open World Survival Craft', 'Base Building'],
    steamGenres: ['Survival', 'Adventure', 'Sobrevivência', 'Action', 'Indie']
  },
  sports: {
    name: 'sports',
    displayName: 'Esporte',
    keywords: [
      'sport', 'esporte', 'futebol', 'football', 'soccer', 'fifa', 'pes', 'efootball',
      'basketball', 'basquete', 'nba', '2k', 'tennis', 'tenis', 'golf', 'golfe',
      'hockey', 'baseball', 'beisebol', 'volleyball', 'volei', 'boxing', 'luta', 'ufc',
      'skate', 'skateboard', 'surf', 'snowboard', 'ski', 'bike', 'ciclismo', 'cycling',
      'wrestling', 'madden', 'nhl', 'mlb', 'cricket', 'rugby', 'american football'
    ],
    steamTags: ['Sports', 'Soccer', 'Football', 'Basketball', 'Baseball', 'Golf', 'Tennis', 'Hockey', 'Fighting', 'Boxing', 'Skating'],
    steamGenres: ['Sports', 'Esporte', 'Esportes', 'Simulation', 'Action']
  }
}

/**
 * Normaliza texto para comparação (lowercase, remove acentos)
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
}

/**
 * Verifica se um jogo pertence a uma categoria baseado em suas tags, genres e título
 */
export function matchesCategory(
  game: {
    title?: string
    tags?: string[]
    genres?: string[]
    steamGenres?: Array<{ id: string; name: string }>
  },
  category: GameCategory
): boolean {
  const def = CATEGORIES[category]

  // Normalizar título
  const normalizedTitle = normalize(game.title || '')

  // Normalizar tags e genres
  const normalizedTags = (game.tags || []).map(normalize)
  const normalizedGenres = (game.genres || []).map(normalize)
  const normalizedSteamGenres = (game.steamGenres || []).map(g => normalize(g.name))

  // Combinar todas as tags e genres
  const allTags = [...normalizedTags, ...normalizedGenres, ...normalizedSteamGenres]

  // Verificar keywords no título
  const titleMatch = def.keywords.some(keyword => normalizedTitle.includes(normalize(keyword)))

  // Verificar tags Steam
  const steamTagMatch = def.steamTags.some(tag =>
    allTags.some(gameTag => gameTag.includes(normalize(tag)) || normalize(tag).includes(gameTag))
  )

  // Verificar genres Steam
  const steamGenreMatch = def.steamGenres.some(genre =>
    allTags.some(gameTag => gameTag.includes(normalize(genre)) || normalize(genre).includes(gameTag))
  )

  return titleMatch || steamTagMatch || steamGenreMatch
}

/**
 * Categoriza um jogo em todas as categorias que se aplicam
 */
export function categorizeGame(game: {
  title?: string
  tags?: string[]
  genres?: string[]
  steamGenres?: Array<{ id: string; name: string }>
}): GameCategory[] {
  const categories: GameCategory[] = []

  for (const category of Object.keys(CATEGORIES) as GameCategory[]) {
    if (matchesCategory(game, category)) {
      categories.push(category)
    }
  }

  return categories
}

/**
 * Filtra uma lista de jogos por categoria
 */
export function filterByCategory<T extends {
  title?: string
  tags?: string[]
  genres?: string[]
  steamGenres?: Array<{ id: string; name: string }>
}>(games: T[], category: GameCategory): T[] {
  return games.filter(game => matchesCategory(game, category))
}
