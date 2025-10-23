import axios, { AxiosResponse } from 'axios';
import { ConsolidatedDeal } from '../../services/consolidated-deals.service';
import { logger } from '../../utils/logger';

// Cache em memória para os dados da Epic Games
const epicCache = new Map<string, { data: any; timestamp: number }>();

// Configurações de cache e timeout
const CACHE_TTL = parseInt(process.env.EPIC_CACHE_TTL || '600') * 1000; // TTL em milissegundos
const TIMEOUT = 6000; // 6 segundos
const MAX_RETRIES = 3;

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



      for (const promotion of promotions) {
        // Verificar se o jogo tem promoção ativa
        const activePromotion = promotion.promotions?.promotionalOffers?.[0]?.promotionalOffers?.find(
          offer => 
            new Date(offer.startDate).getTime() <= Date.now() && 
            (!offer.endDate || new Date(offer.endDate).getTime() >= Date.now())
        );

        // Somente adicionar se houver promoção ativa E o jogo esteja em desconto (não apenas gratuito)
        if (!activePromotion) continue;

        // Verificar se o jogo está em promoção (desconto > 0 ou preço final menor que o original)
        const originalPrice = promotion.price?.totalPrice?.originalPrice;
        const finalPrice = promotion.price?.totalPrice?.discountPrice;
        const discountPercent = promotion.price?.totalPrice?.discount;
        
        // Considerar jogo em promoção se:
        // 1. É gratuito (finalPrice === 0) OU
        // 2. Tem desconto real (finalPrice < originalPrice e desconto > 0)
        const isOnPromotion = finalPrice === 0 || (finalPrice < originalPrice && discountPercent > 0);
        
        if (!isOnPromotion) continue;

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
            discountPct: promotion.price?.totalPrice?.discount ? promotion.price.totalPrice.discount : 0,
            isActive: true
          }],
          bestPrice: {
            store: 'epic',
            price: promotion.price?.totalPrice?.discountPrice ? promotion.price.totalPrice.discountPrice / 100 : 0, // Converter de centavos para reais
            discountPct: promotion.price?.totalPrice?.discount ? promotion.price.totalPrice.discount : 0
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