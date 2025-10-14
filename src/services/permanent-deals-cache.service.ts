import { OfferDTO } from '../adapters/types.js';

// Cache para armazenar ofertas permanentes
let permanentDealsCache: OfferDTO[] = [];
let cacheTimestamp: number | null = null;

/**
 * Gera uma seed baseada na data para garantir que as ofertas mudem diariamente
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
  return `permanent_deals_${year}-${month}-${day}`;
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
 * Seleciona ofertas diárias baseadas na seed (data), mas mantedo a ordem por qualidade
 */
function selectDailyDeals(deals: OfferDTO[], seed: string, count: number = 30): OfferDTO[] {
  if (deals.length <= count) {
    // Ainda ordena por qualidade mesmo que não precise limitar
    return sortOffersByQuality(deals);
  }

  // Primeiro ordena todas as ofertas por qualidade
  const sortedByQuality = sortOffersByQuality(deals);
  
  // Em seguida, embaralha as ofertas com base na seed diária para variação
  const shuffled = seededShuffle(sortedByQuality, seed);
  
  // Retorna as primeiras 'count' ofertas após o embaralhamento seed-based
  return shuffled.slice(0, count);
}

/**
 * Função para atualizar o cache de ofertas permanentes
 */
export async function updatePermanentDealsCache(newDeals: OfferDTO[]): Promise<void> {
  if (newDeals && newDeals.length > 0) {
    // Mantém apenas as ofertas com desconto significativo ou preços atrativos
    const significantDiscounts = newDeals.filter(deal => (deal.discountPct || 0) > 10);
    const withAnyDiscount = newDeals.filter(deal => (deal.discountPct || 0) > 0);
    
    let dealsToCache: OfferDTO[];
    
    if (significantDiscounts.length >= 20) {
      dealsToCache = significantDiscounts;
    } else if (withAnyDiscount.length >= 20) {
      dealsToCache = withAnyDiscount;
    } else {
      // Se não houver ofertas suficientes com desconto, inclui as mais baratas
      const sortedByPrice = [...newDeals].sort((a, b) => (a.priceFinal || 0) - (b.priceFinal || 0));
      dealsToCache = [...withAnyDiscount, ...sortedByPrice.slice(0, 30 - withAnyDiscount.length)];
    }
    
    // Atualiza o cache
    permanentDealsCache = dealsToCache.slice(0, 50); // Limita a 50 ofertas no cache
    cacheTimestamp = Date.now();
    
    console.log(`✓ Cache de ofertas permanentes atualizado com ${permanentDealsCache.length} ofertas`);
  }
}

/**
 * Função para obter ofertas permanentes garantidas
 * Retorna ofertas que estão sempre disponíveis, atualizadas diariamente
 */
export function getPermanentDeals(): OfferDTO[] {
  const now = Date.now();
  
  // Se não houver ofertas no cache, retorna um array vazio
  if (!permanentDealsCache || permanentDealsCache.length === 0) {
    console.log('⚠ Nenhuma oferta disponível no cache permanente');
    return [];
  }
  
  // Gera uma seed baseada na data para garantir que as ofertas mudem diariamente
  const seed = getDailySeed();
  
  // Seleciona as ofertas diárias com base na seed
  const dailyDeals = selectDailyDeals(permanentDealsCache, seed, 30);
  
  console.log(`✓ Retornando ${dailyDeals.length} ofertas diárias do cache permanente com seed: ${seed}`);
  
  // Aplica ordenação por qualidade para garantir as melhores ofertas no topo
  return sortOffersByQuality(dailyDeals);
}

/**
 * Função para verificar se o cache está vazio
 */
export function isPermanentCacheEmpty(): boolean {
  return !permanentDealsCache || permanentDealsCache.length === 0;
}

/**
 * Função para obter todas as ofertas permanentes (sem filtrar por dia)
 */
export function getAllPermanentDeals(): OfferDTO[] {
  return sortOffersByQuality([...permanentDealsCache]);
}

/**
 * Limpa o cache de ofertas permanentes
 */
export function clearPermanentDealsCache(): void {
  permanentDealsCache = [];
  cacheTimestamp = null;
  console.log('✓ Cache de ofertas permanentes limpo');
}