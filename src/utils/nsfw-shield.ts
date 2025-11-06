/**
 * NSFW Shield - Sistema multi-camadas para bloquear conteúdo adulto
 * Baseado em sinais oficiais da Steam/Epic + heurística de texto
 */

import { fetchSteamAgeRating } from '../adapters/steam.adapter.js'

export type GameDoc = {
  appId: number | string;
  store: "steam" | "epic";
  title?: string;
  required_age?: number;                    // Steam
  content_descriptors?: string[];           // Steam - ex.: ["Sexual Content","Nudity"]
  ratings?: { system: "ESRB"|"PEGI"; labels: string[] }[];  // Epic/terceiros
  genres?: string[];
  tags?: string[];
  short_description?: string;
  about_the_game?: string;
  mature_content_description?: string;      // Steam
};

// AppIDs BANIDOS (blacklist de jogos conhecidos - adicionar conforme necessário)
const BANNED_APP_IDS = new Set<string>([
  // Adicionar AppIDs de jogos adultos conhecidos aqui
  // Exemplo: "730690", "1234567"
]);

// Tags/categorias BANIDAS (tudo em minúsculas)
const BANNED_TAGS = new Set([
  "adult only", "nsfw", "hentai", "eroge", "ecchi", "sexual content", "nudity",
  "nude", "erotic", "porn", "r18", "uncensored", "yaoi", "yuri", "tentacle",
  "visual novel", "dating sim", "romance simulation", "bishoujo", "galgame",
  "anime" // Bloquear jogos com tag Anime
]);

// Palavras BANIDAS no TÍTULO (bloqueio imediato)
const BANNED_TITLE_WORDS = new Set([
  "demon love", "demonlove", "wish island", "wishisland",
  "milk", "milf", "anime girl", "anime girls", "anime woman", "anime women",
  "hentai", "ecchi", "hunie", "nekopara", "mirror", "fresh", "freshwomen",
  "achat", "honey select", "koikatsu", "illusion", "seduction", "love island",
  "waifu", "oppai", "boob", "boobs", "sexy", "strip", "stripper"
]);

// Regex para detectar palavras/expressões fortes (pt/en/ja)
const KEYWORD_REGEX = new RegExp(
  String.raw`(?:adult only|adults only|r18|r-18|18\+|nsfw|hentai|eroge|ecchi|porn|pornographic|` +
  String.raw`sexual content|sexualized|explicit sex|sex scene|sex scenes|erotic|lewd|` +
  String.raw`uncensored|nude|nudity|full nudity|partial nudity|boobs|breasts|milk|milf|` +
  String.raw`yaoi|yuri|tentacle|incest|fetish|strip|striptease|fanservice|sensual|provocative|` +
  String.raw`demon love|wish island|anime girl|anime woman|waifu|oppai|` +
  String.raw`conteúdo sexual|sexo explícito|nudez|nudidade|conteúdo adulto|erótico|pornográfico|` +
  String.raw`乳首|裸|エロ)`,
  "i"
);

/**
 * Normaliza lista de strings para lowercase
 */
function normList(list?: string[]): string[] {
  return (list ?? []).map(s => s.trim().toLowerCase());
}

/**
 * Verifica se algum item da lista está no conjunto banido
 */
function anyMatch(list: string[] | undefined, set: Set<string>): string[] {
  const hits: string[] = [];
  for (const item of normList(list)) {
    if (set.has(item)) hits.push(item);
  }
  return hits;
}

/**
 * Verifica se textos contêm palavras-chave banidas
 */
function textHasKeywords(...texts: (string | undefined)[]): string[] {
  const found: string[] = [];
  for (const t of texts) {
    if (!t) continue;
    if (KEYWORD_REGEX.test(t)) {
      // Pega trechinho para explicar
      const m = t.match(KEYWORD_REGEX);
      if (m) found.push(m[0].toLowerCase());
    }
  }
  return Array.from(new Set(found));
}

/**
 * Analisa ratings (ESRB/PEGI) em busca de sinais adultos
 */
function ratingSignals(ratings?: { system: "ESRB"|"PEGI"; labels: string[] }[]) {
  const reasons: string[] = [];
  for (const r of ratings ?? []) {
    const labels = normList(r.labels);
    const joined = labels.join(" | ");
    const sexual =
      labels.some(l =>
        /sexual|nudity|partial nudity|adults only|adult/i.test(l)
      );
    const adultsOnly =
      /adults only|adult only/.test(joined) || labels.includes("18") || labels.includes("pegi 18");
    if (sexual || adultsOnly) reasons.push(`${r.system}: ${joined}`);
  }
  return reasons;
}

/**
 * FUNÇÃO PRINCIPAL: Decide se o jogo deve ser bloqueado (ASYNC)
 * Retorna: { blocked: true/false, reasons: [...] }
 */
export async function decideNSFWAsync(app: GameDoc): Promise<{ blocked: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  // ========================================
  // CAMADA -1: AppID na blacklist (bloqueio INSTANTÂNEO)
  // ========================================
  
  const appIdStr = String(app.appId || '');
  if (BANNED_APP_IDS.has(appIdStr)) {
    reasons.push(`banned_app_id: ${appIdStr}`);
    console.log(`🚫 NSFW Shield BLOQUEOU (APP ID): ${app.title} (${appIdStr})`);
    console.log(`   Motivo: AppID na blacklist`);
    return { blocked: true, reasons };
  }

  // ========================================
  // CAMADA 0: Verificação IMEDIATA de título
  // ========================================
  
  const titleLower = (app.title || '').toLowerCase().trim();
  
  // Verificar palavras banidas no título
  for (const banned of BANNED_TITLE_WORDS) {
    if (titleLower.includes(banned)) {
      reasons.push(`title_blocked: "${banned}"`);
      // Retorna imediatamente se encontrar palavra banida no título
      console.log(`🚫 NSFW Shield BLOQUEOU (TÍTULO): ${app.title}`);
      console.log(`   Motivo: Palavra banida no título: "${banned}"`);
      return { blocked: true, reasons };
    }
  }

  // ========================================
  // CAMADA 0.5: Buscar idade mínima da Steam (se for jogo da Steam e não tiver idade)
  // ========================================
  
  if (app.store === 'steam' && !app.required_age) {
    const steamAge = await fetchSteamAgeRating(appIdStr)
    if (steamAge !== null) {
      app.required_age = steamAge
    }
  }

  // ========================================
  // CAMADA 1: Sinais OFICIAIS (Steam/Epic)
  // ========================================
  
  // 1.1) Idade mínima >= 18
  if ((app.required_age ?? 0) >= 18) {
    reasons.push(`required_age=${app.required_age}`);
  }

  // 1.2) Content Descriptors da Steam
  const descriptorHits = textHasKeywords(...normList(app.content_descriptors));
  if (descriptorHits.length) {
    reasons.push(`content_descriptors: ${descriptorHits.join(", ")}`);
  }

  // 1.3) Mature Content Description
  if (app.mature_content_description && KEYWORD_REGEX.test(app.mature_content_description)) {
    reasons.push("mature_content_description");
  }

  // 1.4) Ratings (ESRB/PEGI da Epic ou terceiros)
  const ratingHits = ratingSignals(app.ratings);
  reasons.push(...ratingHits);

  // ========================================
  // CAMADA 2: Tags/Genres padronizadas
  // ========================================
  
  // 2.1) Tags banidas
  const tagHits = anyMatch(app.tags, BANNED_TAGS);
  if (tagHits.length) {
    reasons.push(`tags: ${tagHits.join(", ")}`);
  }

  // 2.2) Gêneros banidos
  const genreHits = anyMatch(app.genres, BANNED_TAGS);
  if (genreHits.length) {
    reasons.push(`genres: ${genreHits.join(", ")}`);
  }

  // ========================================
  // CAMADA 3: Heurística em descrições
  // ========================================
  
  const kwHits = textHasKeywords(
    app.title,
    app.short_description,
    app.about_the_game,
    app.mature_content_description
  );
  if (kwHits.length) {
    reasons.push(`keywords: ${kwHits.join(", ")}`);
  }

  // ========================================
  // DECISÃO FINAL
  // ========================================
  
  const blocked = reasons.length > 0;

  if (blocked) {
    console.log(`🚫 NSFW Shield BLOQUEOU: ${app.title || app.appId}`);
    console.log(`   Motivos: ${reasons.join(" | ")}`);
  }

  return { blocked, reasons };
}

/**
 * FUNÇÃO SÍNCRONA (sem buscar idade da Steam)
 * Usa apenas dados já disponíveis
 */
export function decideNSFW(app: GameDoc): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Verificações síncronas apenas (sem fetchSteamAgeRating)
  const appIdStr = String(app.appId || '');
  if (BANNED_APP_IDS.has(appIdStr)) {
    reasons.push(`banned_app_id: ${appIdStr}`);
    return { blocked: true, reasons };
  }

  const titleLower = (app.title || '').toLowerCase().trim();
  for (const banned of BANNED_TITLE_WORDS) {
    if (titleLower.includes(banned)) {
      reasons.push(`title_blocked: "${banned}"`);
      return { blocked: true, reasons };
    }
  }

  // Continua com as outras camadas (sem buscar idade)
  if ((app.required_age ?? 0) >= 18) {
    reasons.push(`required_age=${app.required_age}`);
  }

  const descriptorHits = textHasKeywords(...normList(app.content_descriptors));
  if (descriptorHits.length) {
    reasons.push(`content_descriptors: ${descriptorHits.join(", ")}`);
  }

  if (app.mature_content_description && KEYWORD_REGEX.test(app.mature_content_description)) {
    reasons.push("mature_content_description");
  }

  const ratingHits = ratingSignals(app.ratings);
  reasons.push(...ratingHits);

  const tagHits = anyMatch(app.tags, BANNED_TAGS);
  if (tagHits.length) {
    reasons.push(`tags: ${tagHits.join(", ")}`);
  }

  const genreHits = anyMatch(app.genres, BANNED_TAGS);
  if (genreHits.length) {
    reasons.push(`genres: ${genreHits.join(", ")}`);
  }

  const kwHits = textHasKeywords(
    app.title || "",
    app.short_description || "",
    app.about_the_game || "",
    app.mature_content_description || ""
  );
  if (kwHits.length) {
    reasons.push(`keywords: ${kwHits.join(", ")}`);
  }

  const blocked = reasons.length > 0;
  return { blocked, reasons };
}

/**
 * Versão simplificada para compatibilidade com filtro antigo
 * Aceita objetos no formato atual (game, deal, offer)
 */
export function isGameAppropriateV2(game: any): boolean {
  const gameTitle = game.title || game.name || game.game?.title || '';
  const genres = game.genres || game.tags || game.game?.genres || [];
  
  // Converter para formato GameDoc
  const doc: GameDoc = {
    appId: game.storeAppId || game.appId || game.id || 0,
    store: game.store || "steam",
    title: gameTitle,
    required_age: game.required_age,
    content_descriptors: game.content_descriptors,
    ratings: game.ratings,
    genres: Array.isArray(genres) ? genres : [],
    tags: game.tags || [],
    short_description: game.description || game.short_description,
    about_the_game: game.about_the_game,
    mature_content_description: game.mature_content_description
  };
  
  const { blocked } = decideNSFW(doc);
  return !blocked; // Retorna TRUE se APROPRIADO (não bloqueado)
}

/**
 * Filtra array de jogos removendo conteúdo NSFW (ASYNC - busca idade da Steam)
 */
export async function filterNSFWGamesAsync<T>(games: T[]): Promise<T[]> {
  const results = await Promise.all(
    games.map(async (game: any) => {
      const gameTitle = game.title || game.name || game.game?.title || '';
      const genres = game.genres || game.tags || game.game?.genres || [];
      
      const doc: GameDoc = {
        appId: game.storeAppId || game.appId || game.id || 0,
        store: game.store || "steam",
        title: gameTitle,
        required_age: game.required_age,
        content_descriptors: game.content_descriptors,
        ratings: game.ratings,
        genres: Array.isArray(genres) ? genres : [],
        tags: game.tags || [],
        short_description: game.description || game.short_description,
        about_the_game: game.about_the_game,
        mature_content_description: game.mature_content_description
      };
      
      const { blocked } = await decideNSFWAsync(doc);
      return { game, blocked };
    })
  );
  
  const filtered = results.filter(r => !r.blocked).map(r => r.game);
  const removed = games.length - filtered.length;
  
  if (removed > 0) {
    console.log(`🛡️ NSFW Shield (ASYNC): ${removed} jogos adultos removidos de ${games.length} total`);
  }
  
  return filtered;
}

/**
 * Filtra array de jogos removendo conteúdo NSFW (SYNC - sem buscar idade)
 */
export function filterNSFWGames<T>(games: T[]): T[] {
  const filtered = games.filter(isGameAppropriateV2);
  
  const removed = games.length - filtered.length;
  if (removed > 0) {
    console.log(`🛡️ NSFW Shield: ${removed} jogos adultos removidos de ${games.length} total`);
  }
  
  return filtered;
}
