/**
 * Filtro de conteúdo impróprio/adulto
 * Bloqueia jogos com temas sexuais, nudez e outros conteúdos inadequados
 */

// Lista de jogos/títulos que são EXCEÇÕES (jogos legítimos que não devem ser bloqueados)
const ALLOWED_GAMES = [
  // Jogos AAA e conhecidos que contêm palavras bloqueadas mas são legítimos
  'wolfenstein', 'doom', 'resident evil', 'devil may cry', 'bayonetta',
  'god of war', 'the witcher', 'dragon age', 'mass effect', 'final fantasy',
  'monster hunter', 'dark souls', 'bloodborne', 'elden ring',
  'cyberpunk', 'fallout', 'skyrim', 'oblivion', 'morrowind',
  'bioshock', 'borderlands', 'far cry', 'assassins creed', "assassin's creed",
  'tomb raider', 'uncharted', 'the last of us', 'horizon',
  'metal gear', 'street fighter', 'mortal kombat', 'tekken',
  'battlefield', 'call of duty', 'halo', 'gears of war',
  'diablo', 'starcraft', 'warcraft', 'world of warcraft',
  'league of legends', 'dota', 'overwatch', 'apex legends',
  'fortnite', 'pubg', 'valorant', 'counter-strike',
  'minecraft', 'terraria', 'stardew valley', 'hollow knight',
  'celeste', 'hades', 'dead cells', 'binding of isaac',
  // Adicione mais conforme necessário
];

// Lista de palavras proibidas (case-insensitive)
const BLOCKED_KEYWORDS = [
  // Conteúdo sexual/adulto - Variações de SEX
  'sex', 'sexy', 'sexual', 'sexo', 'sexi', 'seks', 'sexe', 'sexs',
  
  // Pornografia e termos adultos
  'porn', 'porno', 'pornô', 'pornografia', 'xxx', 'adult only', '18+',
  
  // Nudez e exposição
  'nude', 'naked', 'nudity', 'nudez', 'pelad', 'pelado', 'pelada',
  'strip', 'stripper', 'bikini babes', 'underwear',
  
  // Hentai e anime adulto
  'hentai', 'ecchi', 'ahegao', 'waifu', 'anime girls',
  
  // Termos eróticos
  'erotic', 'erótico', 'erotica', 'lewd', 'seductive', 'sensual',
  
  // Termos sexuais específicos
  'milf', 'dilf', 'bdsm', 'fetish', 'kink', 'lust', 'orgasm',
  
  // Dating e romance adulto
  'hot girls', 'sexy girls', 'dating sim', 'visual novel',
  'girlfriend', 'boyfriend', 'lovers',
  
  // Marcadores de conteúdo adulto
  'nsfw', 'mature content', 'explicit', 'censored', 'uncensored',
  
  // Jogos/marcas específicas bloqueadas
  'achat', 'hunie', 'nekopara', 'mirror',
  'fresh', 'freshwomen', 'fresh women', 'freshwoman', 'fresh woman',
  'demon love', 'demonlove', 'demon wish', 'wish island',
  
  // Dating/Romance games adultos
  'love game', 'love story', 'love island', 'love simulator',
  'romance game', 'romantic game', 'romance simulation',
  'dating game', 'date sim', 'dating simulator',
  'visual novel',
  
  // Termos genéricos que PODEM indicar conteúdo adulto
  'woman', 'women', 'lady', 'ladies', 'girl', 'girls',
  'babe', 'babes', 'chick', 'chicks', 'female',
  'wife', 'wives', 'bride', 'housewife', 'housewives',
  'mother', 'mom', 'mommy', 'daughter',
  'maid', 'maids', 'nurse', 'nurses', 'teacher',
  'school girl', 'schoolgirl', 'student',
  'beach babe', 'pool babe', 'vacation babe',
  
  // Termos relacionados a conteúdo sexual
  'breast', 'breasts', 'boob', 'boobs', 'tits', 'titties',
  'ass', 'butt', 'thick', 'curvy', 'busty',
  'naughty', 'seduction', 'seduce',
  
  // Violência extrema
  'gore', 'extreme violence', 'torture', 'blood bath'
];

// Gêneros/tags que frequentemente contêm conteúdo adulto
const SUSPICIOUS_GENRES = [
  'adult',
  'adult only',
  'hentai',
  'sexual content',
  'nudity',
  'erotic',
  'anime', // Bloquear todo conteúdo anime
  'dating sim',
  'visual novel',
  'romance',
  'romantic',
  'life sim',
  'erotic sim',
  'erotic simulation',
  'adult simulation',
  'adult sim',
  'mature',
  'mature content',
  'sexy',
  'seductive',
  'lust',
  'lustful',
  'nudist',
  'nsfw',
  'ecchi'
  // Removidos 'indie' e 'casual' - agora usamos INDIE_DANGEROUS_COMBINATIONS
];

/**
 * Categorias ABSOLUTAMENTE BLOQUEADAS - sem exceções
 * Estes gêneros são SEMPRE bloqueados, mesmo se o jogo estiver na whitelist
 */
const ABSOLUTE_BLOCKED_CATEGORIES = [
  'adult only',
  'adult',
  'anime',
  'hentai',
  'sexual content',
  'nudity',
  'nsfw',
  'mature content',
  'erotic',
  'visual novel', // SEMPRE bloquear visual novels
  'dating sim', // SEMPRE bloquear dating sims
  'romance' // SEMPRE bloquear jogos de romance
];

/**
 * Combinações perigosas - se o jogo tem INDIE + uma dessas, é bloqueado
 */
const INDIE_DANGEROUS_COMBINATIONS = [
  'casual',
  'simulation',
  'adventure',
  'rpg',
  'strategy'
];

/**
 * Verifica se o jogo está na lista de exceções (jogos legítimos permitidos)
 */
function isAllowedGame(title: string): boolean {
  if (!title) return false;
  
  const normalizedTitle = title.toLowerCase().trim();
  
  return ALLOWED_GAMES.some(allowedGame => {
    const normalizedAllowed = allowedGame.toLowerCase();
    return normalizedTitle.includes(normalizedAllowed);
  });
}

/**
 * Verifica se um texto contém palavras bloqueadas
 */
function containsBlockedKeyword(text: string): boolean {
  if (!text) return false;
  
  const normalizedText = text.toLowerCase().trim();
  
  return BLOCKED_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase();
    
    // Verificação 1: Palavra exata (case-insensitive)
    if (normalizedText === normalizedKeyword) {
      return true;
    }
    
    // Verificação 2: Palavra completa com limites de palavra (word boundaries)
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
    if (wordBoundaryRegex.test(normalizedText)) {
      return true;
    }
    
    // Verificação 3: Substring (para detectar em palavras compostas)
    // Exemplo: "SEXO AEREO" contém "SEX"
    if (normalizedText.includes(normalizedKeyword)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Escapa caracteres especiais de regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifica se as tags/gêneros contêm categorias ABSOLUTAMENTE bloqueadas
 * Estas categorias são bloqueadas MESMO se o jogo estiver na whitelist
 */
function hasAbsoluteBlockedCategories(genres: string[]): boolean {
  if (!genres || genres.length === 0) return false;
  
  const normalizedGenres = genres.map(g => g.toLowerCase().trim());
  
  const hasBlocked = ABSOLUTE_BLOCKED_CATEGORIES.some(blocked => 
    normalizedGenres.some(genre => {
      const normalizedBlocked = blocked.toLowerCase();
      // Verifica se o gênero contém ou é exatamente a categoria bloqueada
      return genre === normalizedBlocked || genre.includes(normalizedBlocked);
    })
  );
  
  if (hasBlocked) {
    console.log(`🚫 CATEGORIA ABSOLUTAMENTE BLOQUEADA detectada em: ${genres.join(', ')}`);
  }
  
  return hasBlocked;
}

/**
 * Verifica combinações perigosas de Indie com outros gêneros
 * Jogos indie + casual/simulation/adventure/rpg são frequentemente adultos
 */
function hasIndieDangerousCombination(genres: string[]): boolean {
  if (!genres || genres.length === 0) return false;
  
  const normalizedGenres = genres.map(g => g.toLowerCase().trim());
  const hasIndie = normalizedGenres.some(g => g.includes('indie'));
  
  if (!hasIndie) return false;
  
  const hasDangerous = INDIE_DANGEROUS_COMBINATIONS.some(dangerous =>
    normalizedGenres.some(genre => genre.includes(dangerous))
  );
  
  if (hasDangerous) {
    console.log(`⚠️ COMBINAÇÃO PERIGOSA: Indie + ${normalizedGenres.join(', ')}`);
    return true;
  }
  
  return false;
}

/**
 * Verifica se as tags/gêneros contêm conteúdo suspeito
 */
function hasSuspiciousGenres(genres: string[]): boolean {
  if (!genres || genres.length === 0) return false;
  
  const normalizedGenres = genres.map(g => g.toLowerCase());
  
  return SUSPICIOUS_GENRES.some(suspicious => 
    normalizedGenres.some(genre => genre.includes(suspicious))
  );
}

/**
 * Filtra jogo individual verificando todos os campos relevantes
 */
export function isGameAppropriate(game: any): boolean {
  const gameTitle = game.title || game.name || game.game?.title || '';
  const genres = game.genres || game.tags || game.game?.genres || [];
  
  // PRIORIDADE MÁXIMA: Bloquear categorias absolutas (Adult Only, Anime, Visual Novel, etc)
  // Estas categorias são bloqueadas MESMO se o jogo estiver na whitelist
  if (hasAbsoluteBlockedCategories(genres)) {
    console.log(`🚫 BLOQUEIO ABSOLUTO: ${gameTitle} - Categoria proibida: ${genres.join(', ')}`);
    return false;
  }
  
  // SEGUNDO: Verificar se é um jogo permitido (exceção)
  // Jogos AAA conhecidos que podem ter palavras genéricas (woman, girl, etc)
  if (isAllowedGame(gameTitle)) {
    console.log(`✅ Jogo permitido (exceção): ${gameTitle}`);
    return true;
  }
  
  // TERCEIRO: Verificar combinações perigosas (Indie + Casual/Simulation/etc)
  // Muitos jogos pornôs são indie + casual ou indie + simulation
  if (hasIndieDangerousCombination(genres)) {
    console.log(`🚫 BLOQUEIO POR COMBINAÇÃO PERIGOSA: ${gameTitle} - ${genres.join(', ')}`);
    return false;
  }
  
  // Verificar título
  if (containsBlockedKeyword(gameTitle)) {
    console.log(`🚫 Bloqueado por título: ${gameTitle}`);
    return false;
  }
  
  // Verificar descrição
  if (containsBlockedKeyword(game.description || game.game?.description)) {
    console.log(`🚫 Bloqueado por descrição: ${gameTitle}`);
    return false;
  }
  
  // Verificar tags/gêneros suspeitos
  if (hasSuspiciousGenres(genres)) {
    console.log(`🚫 Bloqueado por gênero: ${gameTitle} - ${genres.join(', ')}`);
    return false;
  }
  
  // Verificar store (alguns jogos marcados explicitamente)
  if (game.mature === true || game.adult === true) {
    console.log(`🚫 Bloqueado por flag adulto: ${game.title || game.name}`);
    return false;
  }
  
  return true;
}

/**
 * Filtra array de jogos removendo conteúdo impróprio
 */
export function filterInappropriateGames<T>(games: T[]): T[] {
  const filtered = games.filter(isGameAppropriate);
  
  const removed = games.length - filtered.length;
  if (removed > 0) {
    console.log(`🔒 Filtro de conteúdo: ${removed} jogos impróprios removidos de ${games.length} total`);
  }
  
  return filtered;
}

/**
 * Verifica se uma string é segura para exibição
 */
export function isSafeText(text: string): boolean {
  return !containsBlockedKeyword(text);
}
