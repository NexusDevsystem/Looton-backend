import axios, { AxiosResponse } from 'axios';
import { ConsolidatedDeal } from '../../services/consolidated-deals.service';
import { logger } from '../../utils/logger';

// Função para calcular o desconto percentual de forma segura
function calculateDiscountPercent(originalPrice: number = 0, finalPrice: number = 0): number {
  // Se o preço original é 0, não há como calcular desconto
  if (originalPrice <= 0) {
    // Se o preço final também é 0, é um jogo grátis, mas sem preço original conhecido
    // Vamos considerar 100% de desconto se o final for 0
    return finalPrice === 0 ? 100 : 0;
  }
  
  // Se o preço final é 0, é 100% de desconto (jogo grátis)
  if (finalPrice === 0) {
    return 100;
  }
  
  // Cálculo normal do desconto
  const discount = ((originalPrice - finalPrice) / originalPrice) * 100;
  
  // Validar o resultado e retornar um valor dentro dos limites razoáveis
  if (isNaN(discount) || discount < 0 || discount > 100) {
    // Se o desconto calculado é inválido, verificar casos especiais
    if (finalPrice === 0) {
      return 100; // Jogo grátis
    } else if (finalPrice >= originalPrice) {
      return 0; // Sem desconto ou preço aumentou
    } else {
      // Retornar 0 como fallback seguro
      return 0;
    }
  }
  
  // Arredondar para um número inteiro para consistência
  return Math.round(discount);
}

// Cache em memória para os dados da Epic Games
const epicCache = new Map<string, { data: any; timestamp: number }>();

// Configurações de cache e timeout
// Reduzido para 5 minutos para atualizar mais frequentemente
const CACHE_TTL = parseInt(process.env.EPIC_CACHE_TTL || '300') * 1000; // TTL em milissegundos (padrão: 5 min)
const TIMEOUT = 6000; // 6 segundos
const MAX_RETRIES = 3;

/**
 * Limpa o cache da Epic Games
 * Útil para forçar uma atualização imediata dos jogos grátis
 */
export function clearEpicCache(): void {
  epicCache.clear();
  logger.info('Cache da Epic Games limpo manualmente');
}

interface EpicGamePromotion {
  id: string;
  namespace: string;
  title: string;
  description: string;
  effectiveDate: string;
  expiryDate: string | null;
  keyImages: Array<{
    type: string;
    url: string;
  }>;
  privacyUrl: string | null;
  refundPolicy: string;
  status: string;
  isCodeRedemptionOnly: boolean;
  claimDateBegin: string | null;
  claimDateEnd: string | null;
  developer: string;
  publisher: string;
  dlcOffer: boolean;
  freeDays: number | null;
  discountSetting: {
    discountType: string;
    discountPercentage: number;
  };
  urlSlug: string;
  productSlug: string | null;
  url: string | null;
  tags: Array<{
    id: string;
  }>;
  technicalDetails: string | null;
  customAttributes: Array<{
    key: string;
    value: string;
  }>;
  categories: Array<{
    path: string;
  }>;
  catalogNs: {
    mappings: Array<{
      pageSlug: string;
      pageType: string;
    }> | null;
  } | null;
  offerMappings: Array<{
    pageSlug: string;
    pageType: string;
  }>;
  price: {
    totalPrice: {
      discountPrice: number;
      originalPrice: number;
      voucherDiscount: number;
      discount: number;
      currencyCode: string;
      currencyInfo: {
        decimals: number;
      };
      fmtPrice: {
        originalPrice: string;
        discountPrice: string;
        intermediatePrice: string;
      };
    };
    lineOffers: Array<{
      appliedRules: Array<{
        id: string;
        endDate: string;
        discountSetting: {
          discountType: string;
        };
      }>;
    }>;
  };
  promotions: {
    promotionalOffers: Array<{
      promotionalOffers: Array<{
        startDate: string;
        endDate: string;
        discountSetting: {
          discountType: string;
          discountPercentage: number;
        };
      }>;
    }>;
    upcomingPromotionalOffers: Array<{
      promotionalOffers: Array<{
        startDate: string;
        endDate: string;
        discountSetting: {
          discountType: string;
          discountPercentage: number;
        };
      }>;
    }>;
  } | null;
  offerType: string;
}

interface EpicGamesResponse {
  data: {
    Catalog: {
      searchStore: {
        elements: EpicGamePromotion[];
      };
    };
  };
  errors?: Array<{
    message: string;
    locations: Array<{
      line: number;
      column: number;
    }>;
    correlationId: string;
    serviceResponse: string;
    stack: string | null;
    path: string[];
    status: number;
  }>;
}

/**
 * Busca jogos grátis na Epic Games
 * @param locale Localidade (padrão: pt-BR)
 * @param country País (padrão: BR)
 * @param allowCountries Países permitidos (padrão: BR)
 * @returns Lista de jogos grátis e próximos grátis da Epic Games
 */
export async function listFreeGames(
  locale: string = 'pt-BR',
  country: string = 'BR',
  allowCountries: string = 'BR'
): Promise<ConsolidatedDeal[]> {
  const cacheKey = `epic-free-games-${locale}-${country}`;
  const cached = epicCache.get(cacheKey);

  // Verificar se temos dados em cache e ainda não expiraram
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info('Retornando dados da Epic Games do cache');
    return cached.data;
  }

  const url = `${process.env.EPIC_FREE_BASE || 'https://store-site-backend-static.ak.epicgames.com'}/freeGamesPromotions?locale=${locale}&country=${country}&allowCountries=${allowCountries}`;

  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < MAX_RETRIES) {
    try {
      logger.info('Buscando jogos grátis da Epic Games');

      const response: AxiosResponse<EpicGamesResponse> = await axios.get(url, {
        timeout: TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LootonBot/1.0)',
          'Accept': 'application/json',
        }
      });

      const promotions = response.data.data.Catalog.searchStore.elements;
      const deals: ConsolidatedDeal[] = [];



      const now = Date.now();
      logger.info(`🕒 Backend - Processando ${promotions.length} promoções da Epic Games`);

      for (const promotion of promotions) {
        // Verificar se o jogo tem promoção ATIVA NO MOMENTO
        const activePromotion = promotion.promotions?.promotionalOffers?.[0]?.promotionalOffers?.find(
          offer => {
            const startTime = new Date(offer.startDate).getTime();
            const endTime = new Date(offer.endDate).getTime();
            const isActive = startTime <= now && now < endTime; // Mudado para < ao invés de >=

            if (!isActive && promotion.title) {
              logger.debug(`🚫 "${promotion.title}" - Promoção não ativa. Start: ${offer.startDate}, End: ${offer.endDate}, Now: ${new Date(now).toISOString()}`);
            }

            return isActive;
          }
        );

        // Somente adicionar se houver promoção ativa
        if (!activePromotion) {
          if (promotion.title) {
            logger.debug(`🚫 Filtrando "${promotion.title}" - Sem promoção ativa`);
          }
          continue;
        }

        // Verificar se o jogo está realmente em promoção
        const originalPrice = promotion.price?.totalPrice?.originalPrice || 0;
        const finalPrice = promotion.price?.totalPrice?.discountPrice || 0;
        const calculatedDiscountPercent = calculateDiscountPercent(originalPrice, finalPrice);

        // Critérios mais rigorosos:
        // 1. É GRÁTIS (finalPrice === 0) OU
        // 2. Tem desconto real E SIGNIFICATIVO (finalPrice < originalPrice e desconto >= 10%)
        const isFree = finalPrice === 0;
        const hasSignificantDiscount = finalPrice < originalPrice && calculatedDiscountPercent >= 10;
        const isOnPromotion = isFree || hasSignificantDiscount;

        if (!isOnPromotion) {
          if (promotion.title) {
            logger.debug(`🚫 Filtrando "${promotion.title}" - Preço: ${finalPrice}, Original: ${originalPrice}, Desconto: ${calculatedDiscountPercent}%`);
          }
          continue;
        }

        logger.info(`✅ Incluindo "${promotion.title}" - Grátis: ${isFree}, Desconto: ${calculatedDiscountPercent}%, Termina: ${activePromotion.endDate}`);

        // Buscar imagem de capa do tipo "Thumbnail" ou "OfferImageTall" ou "OfferImageWide"
        let coverUrl = '';
        if (promotion.keyImages && promotion.keyImages.length > 0) {
          // Preferir imagens do tipo Thumbnail, depois OfferImageTall, depois OfferImageWide
          const thumbnail = promotion.keyImages.find(img => img.type === 'Thumbnail');
          const offerImageTall = promotion.keyImages.find(img => img.type === 'OfferImageTall');
          const offerImageWide = promotion.keyImages.find(img => img.type === 'OfferImageWide');
          
          coverUrl = thumbnail?.url || offerImageTall?.url || offerImageWide?.url || promotion.keyImages[0]?.url || '';
        }

        const slug = promotion.productSlug || promotion.urlSlug || promotion.catalogNs?.mappings?.[0]?.pageSlug || 
                    promotion.offerMappings?.[0]?.pageSlug || promotion.title.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, '');

        // Converter para o formato ConsolidatedDeal
        const deal: ConsolidatedDeal = {
          id: `epic_${promotion.namespace}:${promotion.id}`,
          title: promotion.title,
          slug: slug.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, ''),
          coverUrl: coverUrl,
          genres: [],
          tags: promotion.tags?.map(tag => tag.id) || [],
          kind: promotion.offerType === 'DLC' || promotion.offerType === 'ADD_ON' ? 'dlc' : 'game',
          isFree: promotion.price?.totalPrice?.discountPrice === 0,
          baseGameTitle: undefined,
          currency: promotion.price?.totalPrice?.currencyCode || 'USD',
          releaseDate: promotion.effectiveDate,
          stores: [{
            store: 'epic',
            storeAppId: promotion.id,
            url: promotion.url ? promotion.url : `https://store.epicgames.com/pt-BR/p/${slug}`,
            priceBase: promotion.price?.totalPrice?.originalPrice ? promotion.price.totalPrice.originalPrice / 100 : 0, // Converter de centavos para reais
            priceFinal: promotion.price?.totalPrice?.discountPrice ? promotion.price.totalPrice.discountPrice / 100 : 0, // Converter de centavos para reais
            discountPct: calculateDiscountPercent(promotion.price?.totalPrice?.originalPrice, promotion.price?.totalPrice?.discountPrice),
            isActive: true
          }],
          bestPrice: {
            store: 'epic',
            price: promotion.price?.totalPrice?.discountPrice ? promotion.price.totalPrice.discountPrice / 100 : 0, // Converter de centavos para reais
            discountPct: calculateDiscountPercent(promotion.price?.totalPrice?.originalPrice, promotion.price?.totalPrice?.discountPrice)
          },
          totalStores: 1
        };

        deals.push(deal);
      }

      // Armazenar em cache
      epicCache.set(cacheKey, { data: deals, timestamp: Date.now() });
      
      logger.info('Dados da Epic Games atualizados com sucesso');
      return deals;
    } catch (error) {
      retryCount++;
      lastError = error as Error;
      logger.error(`Erro ao buscar dados da Epic Games (tentativa ${retryCount}/${MAX_RETRIES})`);
      
      if (retryCount < MAX_RETRIES) {
        // Aguardar antes de tentar novamente (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  // Se todas as tentativas falharem, retornar erro
  logger.error('Todas as tentativas de buscar dados da Epic Games falharam');
  throw lastError;
}