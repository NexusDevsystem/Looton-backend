/**
 * Filtro de conteúdo impróprio/adulto
 * Bloqueia jogos com temas sexuais, nudez e outros conteúdos inadequados
 */

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
  'girlfriend', 'boyfriend', 'lovers', 'romance',
  
  // Marcadores de conteúdo adulto
  'nsfw', 'mature', 'explicit', 'censored', 'uncensored',
  
  // Jogos/marcas específicas bloqueadas
  'achat', 'hunie', 'nekopara', 'mirror',
  'fresh', 'freshwomen', 'fresh women', 'freshwoman', 'fresh woman',
  
  // Palavras relacionadas a mulheres que frequentemente indicam conteúdo adulto
  'woman', 'women', 'lady', 'ladies', 'female', 'fem', 'feminine', 'feminine wiles', 'female warrior',
  'naughty woman', 'naughty women', 'sexy woman', 'sexy women', 'hot woman', 'hot women',
  'busty woman', 'busty women', 'curvy woman', 'curvy women', 'slim woman', 'slim women',
  'bachelor', 'bachelor party', 'bachelor life', 'bachelor game',
  'housewives', 'house wife', 'house wife life', 'house wife game',
  'mother', 'mom', 'moms', 'mother game', 'mom game', 'mommy game',
  'daughter', 'daughter game', 'family', 'family game', 'family life',
  'maid', 'maid game', 'maids', 'maid life', 'maid simulator',
  'nurse', 'nurse game', 'doctors and nurses', 'hospital game',
  'teacher', 'teacher game', 'student teacher', 'school girl', 'school life',
  
  // Variações em outros idiomas
  'mulher', 'mulheres', 'senhora', 'senhoras', 'feminina', 'feminino', 'mulherada',
  'frau', 'frauen', 'donna', 'donne', 'femme', 'femmes', 'mujer', 'mujeres',
  'femme', 'femminile', 'feminino', 'feminina', 'donna', 'fille', 'filles',
  'girl', 'girls', 'young woman', 'young women', 'adult woman', 'adult women',
  'wife', 'wives', 'bride', 'brides', 'babe', 'babes', 'chick', 'chicks',
  'babe game', 'babe life', 'chick game', 'chick life',
  
  // Termos em contextos potencialmente adultos
  'nurse', 'nurses', 'teacher', 'teachers', 'maid', 'maids', 'maidens', 'school',
  'school girl', 'school girls', 'student', 'students', 'teacher student',
  'housewife', 'housewives', 'mom', 'moms', 'mother', 'mothers', 'mommy',
  'daughter', 'daughters', 'family', 'family life', 'step', 'stepsis',
  'stepsister', 'stepbrother', 'bff', 'bffs', 'best friend', 'bestfriends',
  'beach', 'beach babe', 'beach babes', 'pool', 'pool babe', 'pool babes',
  'vacation', 'vacation babe', 'vacation babes', 'trip', 'trip babe', 'trip babes',
  
  // Termos relacionados a conteúdos eróticos/sugestivos
  'milk', 'milky', 'lactation', 'lactating', 'breast', 'breasts', 'boob', 'boobs',
  'tits', 'titties', 'ass', 'asses', 'butt', 'butts', 'thick', 'thick girl', 'thick girls',
  'curvy', 'curves', 'busty', 'bust', 'hot', 'hot girl', 'hot girls', 'naughty',
  'naughty girl', 'naughty girls', 'seductive', 'seduce', 'seduction',
  'erotic', 'erotic game', 'erotic life', 'erotic sim', 'erotic simulation',
  'lust', 'lustful', 'naughty nurse', 'sexy nurse', 'hot nurse',
  'adult only', 'adult game', 'adult content', 'mature content', 'mature game',
  
  // Termos relacionados a conteúdos eróticos/sugestivos
  'milk', 'milky', 'lactation', 'lactating', 'breast', 'breasts', 'boob', 'boobs',
  'tits', 'titties', 'ass', 'asses', 'butt', 'butts', 'thick', 'thick girl', 'thick girls',
  'curvy', 'curves', 'busty', 'bust', 'hot', 'hot girl', 'hot girls', 'naughty',
  'naughty girl', 'naughty girls', 'seductive', 'seduce', 'seduction',
  'erotic', 'erotic game', 'erotic life', 'erotic sim', 'erotic simulation',
  'lust', 'lustful', 'naughty nurse', 'sexy nurse', 'hot nurse',
  'adult only', 'adult game', 'adult content', 'mature content', 'mature game',

  // Violência extrema
  'gore', 'extreme violence', 'torture', 'blood bath',

  // Jogo específico a ser bloqueado
  'Shoot! & Ahhhhh~'
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
];

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
    
    // Verificação 4: Remover caracteres especiais para comparação
    const textNoSpecialChars = normalizedText.replace(/[^\w\s]/g, ' ');
    const keywordNoSpecialChars = normalizedKeyword.replace(/[^\w\s]/g, ' ');
    if (textNoSpecialChars.includes(keywordNoSpecialChars)) {
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
