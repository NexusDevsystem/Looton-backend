/**
 * Filtro de conteúdo impróprio/adulto
 * Bloqueia jogos com temas sexuais, nudez e outros conteúdos inadequados
 */

// Lista de palavras proibidas (case-insensitive)
const BLOCKED_KEYWORDS = [
  // Conteúdo sexual/adulto
  'sex', 'sexy', 'hentai', 'porn', 'milf', 'xxx', 'nude', 'naked', 'ecchi',
  'erotic', 'adult only', '18+', 'nsfw', 'lewd', 'seductive', 'bikini babes',
  
  // Variações em português
  'sexo', 'sexual', 'erótico', 'adulto', 'nudez', 'pelad',
  
  // Tags Steam adultas
  'sexual content', 'nudity', 'mature', 'anime girls',
  
  // Palavras compostas comuns
  'hot girls', 'sexy girls', 'dating sim', 'visual novel',
  
  // Outros termos problemáticos
  'gore', 'extreme violence', 'torture'
];

// Gêneros/tags que frequentemente contêm conteúdo adulto
const SUSPICIOUS_GENRES = [
  'adult',
  'adult only',
  'hentai',
  'sexual content',
  'nudity',
  'erotic',
  'anime' // Bloquear todo conteúdo anime
];

/**
 * Verifica se um texto contém palavras bloqueadas
 */
function containsBlockedKeyword(text: string): boolean {
  if (!text) return false;
  
  const normalizedText = text.toLowerCase();
  
  return BLOCKED_KEYWORDS.some(keyword => {
    // Busca palavra completa ou parte de palavra composta
    const regex = new RegExp(`\\b${keyword}\\b|${keyword}`, 'i');
    return regex.test(normalizedText);
  });
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
  // Verificar título
  if (containsBlockedKeyword(game.title || game.name || game.game?.title)) {
    console.log(`🚫 Bloqueado por título: ${game.title || game.name}`);
    return false;
  }
  
  // Verificar descrição
  if (containsBlockedKeyword(game.description || game.game?.description)) {
    console.log(`🚫 Bloqueado por descrição: ${game.title || game.name}`);
    return false;
  }
  
  // Verificar tags/gêneros
  const genres = game.genres || game.tags || game.game?.genres || [];
  if (hasSuspiciousGenres(genres)) {
    console.log(`🚫 Bloqueado por gênero: ${game.title || game.name} - ${genres.join(', ')}`);
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
