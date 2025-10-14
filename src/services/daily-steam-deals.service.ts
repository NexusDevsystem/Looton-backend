import { steamAdapter } from '../adapters/steam.adapter.js';
import { epicAdapter } from '../adapters/epic.adapter.js';
import { OfferDTO } from '../adapters/types.js';
import { updatePermanentDealsCache, getPermanentDeals, isPermanentCacheEmpty } from './permanent-deals-cache.service.js';

// Cache para armazenar as ofertas diárias
let dailyDealsCache: OfferDTO[] | null = null;
let cacheTimestamp: number | null = null;
let cacheDate: string | null = null;

/**
 * Gera uma seed baseada na data para garantir que os jogos mudem diariamente
 */
function getDailySeed(): string {
  const tz = process.env.FEED_TZ || 'America/Fortaleza';
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [day, month, year] = fmt.format(now).split('/');
  return `daily_deals_${year}-${month}-${day}`;
}

/**
 * Função auxiliar para gerar um número pseudo-aleatório baseado em seed
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/**
 * Função para gerar números pseudo-aleatórios baseados em seed
 */
function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha um array usando o algoritmo Fisher-Yates com base em uma seed
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  // Cria gerador baseado na seed
  const rand = mulberry32(xmur3(seed)());
  
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Calcula uma pontuação de qualidade para uma oferta, considerando múltiplos fatores
 */
function calculateOfferQualityScore(offer: OfferDTO): number {
  const discountPercent = offer.discountPct || 0;
  const originalPrice = offer.priceOriginal || 0;
  const finalPrice = offer.priceFinal || 0;
  
  // Fatores de pontuação:
  // 1. Desconto percentual (mais importante)
  const discountScore = discountPercent;
  
  // 2. Valor do desconto em reais (mais valioso para preços mais altos)
  const discountValue = originalPrice - finalPrice;
  const discountValueScore = Math.min(discountValue / 10, 50); // Cap para evitar valores muito altos
  
  // 3. Popularidade (se disponível)
  const popularityScore = offer.trend || 0;
  
  // 4. Preço final (ofertas mais baratas podem ter leve vantagem para acessibilidade)
  // Mas priorizamos mais o desconto do que o preço baixo sozinho
  const priceScore = finalPrice > 0 ? Math.max(0, 20 - (finalPrice / 10)) : 0;
  
  // 5. Valor da oferta (desconto percentual ponderado pelo preço original)
  const valueScore = discountPercent > 0 ? (discountPercent * Math.log(originalPrice + 1)) / 10 : 0;
  
  // Combinação ponderada dos fatores (ajustável conforme necessário)
  const totalScore = 
    (discountScore * 0.4) +      // 40% para desconto percentual
    (discountValueScore * 0.2) + // 20% para valor do desconto
    (popularityScore * 0.15) +   // 15% para popularidade
    (valueScore * 0.15) +        // 15% para valor da oferta
    (priceScore * 0.1);          // 10% para preço acessível

  return totalScore;
}

/**
 * Ordena as ofertas pelas melhores primeiras, com base em múltiplos critérios
 */
function sortOffersByQuality(offers: OfferDTO[]): OfferDTO[] {
  return [...offers].sort((a, b) => {
    const scoreA = calculateOfferQualityScore(a);
    const scoreB = calculateOfferQualityScore(b);
    
    // Ordena em ordem decrescente (maior pontuação primeiro)
    return scoreB - scoreA;
  });
}

/**
 * Seleciona jogos diários baseados na seed (data), mas mantedo a ordem por qualidade
 */
function selectDailyGames(games: OfferDTO[], seed: string, count: number = 50): OfferDTO[] {
  if (games.length <= count) {
    // Ainda ordena por qualidade mesmo que não precise limitar
    return sortOffersByQuality(games);
  }

  // Primeiro ordena todos os jogos por qualidade
  const sortedByQuality = sortOffersByQuality(games);
  
  // Em seguida, embaralha os jogos com base na seed diária para variação
  const shuffled = seededShuffle(sortedByQuality, seed);
  
  // Retorna os primeiros 'count' jogos após o embaralhamento seed-based
  return shuffled.slice(0, count);
}

/**
 * Obtém as ofertas diárias da Steam (mudam a cada dia)
 */
export async function getDailySteamDeals(forceRefresh = false): Promise<OfferDTO[]> {
  const now = Date.now();
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const oneHour = 60 * 60 * 1000; // 1 hora em milissegundos

  // Se for refresh forçado, ou se for um novo dia, atualizamos o cache
  const shouldRefresh = forceRefresh || 
                       !dailyDealsCache || 
                       !cacheDate || 
                       cacheDate !== currentDate || 
                       (cacheTimestamp && (now - cacheTimestamp) >= oneHour);

  if (!shouldRefresh && dailyDealsCache) {
    console.log('Using cached daily Steam deals');
    // Mesmo usando o cache, vamos reordenar com as novas regras de qualidade
    // para garantir que as melhores ofertas fiquem no topo
    return sortOffersByQuality(dailyDealsCache);
  }

  try {
    console.log('Fetching fresh Steam and Epic data for daily deals...');
    
    // Busca os dados reais da Steam e da Epic
    const [allSteamGames, allEpicGames] = await Promise.all([
      steamAdapter.fetchTrending(),
      epicAdapter.fetchTrending()
    ]);
    
    // Combina ofertas de ambas as lojas
    const allGames = [...allSteamGames, ...allEpicGames];
    
    // Atualiza o cache permanente com as ofertas mais recentes de ambas as lojas
    await updatePermanentDealsCache(allGames);
    
    // Filtra para manter apenas os jogos com desconto significativo (maior que 10%)
    const discountedGames = allGames.filter(game => (game.discountPct || 0) > 10);
    
    let dailyGames: OfferDTO[];
    
    if (discountedGames.length === 0) {
      // Se não houver ofertas com mais de 10%, pegue as com desconto mesmo assim
      console.log('No deals with >10% discount found, falling back to all discounted games');
      const allDiscounted = allGames.filter(game => (game.discountPct || 0) > 0);
      
      if (allDiscounted.length === 0) {
        // Se não houver nenhuma oferta, pegue os jogos mais baratos ou com preços atrativos
        console.log('No discounted games found, falling back to most attractive offers');
        // Ordena por qualidade mesmo sem desconto (considera preço e popularidade)
        const sortedByQuality = sortOffersByQuality(allGames);
        const seed = getDailySeed();
        dailyGames = selectDailyGames(sortedByQuality, seed, 50);
        console.log(`Selected ${dailyGames.length} daily games (fallback: best offers) with seed: ${seed}`);
      } else {
        // Ordena as ofertas com qualquer desconto por qualidade
        const sortedGames = sortOffersByQuality(allDiscounted);
        
        const seed = getDailySeed();
        dailyGames = selectDailyGames(sortedGames, seed, 50);
        console.log(`Selected ${dailyGames.length} daily deals (fallback: all discounts) with seed: ${seed}`);
      }
    } else {
      // Ordena as ofertas por qualidade (considerando desconto, valor, popularidade, etc.)
      const sortedGames = sortOffersByQuality(discountedGames);
      
      // Gera a seed baseada na data
      const seed = getDailySeed();
      
      // Seleciona os jogos diários com base na seed, mantendo a ordem por qualidade
      dailyGames = selectDailyGames(sortedGames, seed, 50);
      
      console.log(`Selected ${dailyGames.length} daily deals with seed: ${seed}`);
    }
    
    // Atualiza o cache diário
    dailyDealsCache = dailyGames;
    cacheTimestamp = now;
    cacheDate = currentDate;
    
    // Se ainda não houver ofertas suficientes, vamos buscar do cache permanente
    if (dailyGames.length === 0 && !isPermanentCacheEmpty()) {
      console.log('Nenhuma oferta encontrada, usando cache permanente');
      return getPermanentDeals();
    }
    
    return dailyGames;
  } catch (error) {
    console.error('Error fetching daily Steam deals:', error);
    
    // Em caso de erro, tenta retornar dados do cache permanente
    const permanentDeals = getPermanentDeals();
    if (permanentDeals.length > 0) {
      console.log('Retornando dados do cache permanente devido a erro');
      return permanentDeals;
    }
    
    // Retorna cache diário mesmo que antigo em caso de erro e sem cache permanente
    if (dailyDealsCache) {
      console.log('Retornando cache diário antigo devido a erro');
      return dailyDealsCache;
    }
    
    // Se tudo mais falhar, retorna array vazio (isso não deve acontecer se o cache permanente estiver funcionando)
    console.log('Nenhuma oferta disponível mesmo após fallbacks');
    return [];
  }
}

/**
 * Força atualização do cache (útil para testes ou atualizações manuais)
 */
export function clearDailyDealsCache(): void {
  dailyDealsCache = null;
  cacheTimestamp = null;
  cacheDate = null;
}