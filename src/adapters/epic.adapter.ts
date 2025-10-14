import { OfferDTO, StoreAdapter } from './types.js'
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js'

// Cache curto para ofertas da Epic para evitar excesso de requisições
let cachedEpicOffers: OfferDTO[] = [];
let lastEpicFetch: number = 0;
const EPIC_CACHE_DURATION = 300000; // 5 minutos

export const epicAdapter: StoreAdapter = {
  async fetchTrending(): Promise<OfferDTO[]> {
    const now = Date.now();
    
    // Usar cache se ainda estiver válido
    if (cachedEpicOffers.length > 0 && (now - lastEpicFetch) < EPIC_CACHE_DURATION) {
      console.log(`Epic: usando cache com ${cachedEpicOffers.length} ofertas`);
      return cachedEpicOffers;
    }

    try {
      console.log('🎮 Buscando ofertas da Epic Games...');
      
      // Fazendo requisição à API da Epic Games
      const url = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR';
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Referer': 'https://store.epicgames.com/'
        }
      }, 15000); // 15 segundos de timeout
      
      if (!response.ok) {
        console.error(`Epic API error: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      const elements = data?.data?.Catalog?.searchStore?.elements || [];
      
      // Filtrar apenas jogos com promoção
      const promotionalGames = elements.filter((game: any) => {
        const promotions = game.promotions;
        return promotions && 
               promotions.promotionalOffers && 
               promotions.promotionalOffers.length > 0;
      });
      
      // Converter dados da Epic para o formato OfferDTO
      const offers: OfferDTO[] = promotionalGames.map((game: any) => {
        const price = game.priceTotalInSubCategory;
        const originalPrice = price?.discountPrice || 0;
        const finalPrice = price?.originalPrice || 0;
        
        // Calcular desconto
        let discountPct = 0;
        if (originalPrice > 0) {
          discountPct = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
        }
        
        // Pegar a primeira promoção disponível
        const promo = game.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
        const startDate = promo?.startDate ? new Date(promo.startDate).toISOString() : '';
        const endDate = promo?.endDate ? new Date(promo.endDate).toISOString() : '';
        
        return {
          store: 'epic',
          storeAppId: game.id || game.offerId || '',
          title: game.title || game.offer?.title || '',
          url: `https://store.epicgames.com/p/${game.catalogNs?.mapping || game.offerId || ''}`,
          priceBaseCents: originalPrice * 100 || null,
          priceFinalCents: finalPrice * 100 || null,
          discountPct: discountPct || 0,
          currency: 'BRL',
          priceBase: originalPrice || 0,
          priceFinal: finalPrice || 0,
          isActive: true,
          coverUrl: game.keyImages?.find((img: any) => img.type === 'DieselStoreFrontWide')?.url || 
                   game.keyImages?.find((img: any) => img.type === 'Thumbnail')?.url,
          genres: game.categories?.map((cat: any) => cat.path) || [],
          tags: game.tags?.map((tag: any) => tag.name) || [],
          trend: game.rating || 0
        } as OfferDTO;
      }).filter((offer: OfferDTO) => offer.title); // Filtrar ofertas válidas
      
      // Atualizar cache
      cachedEpicOffers = offers;
      lastEpicFetch = now;
      
      console.log(`✅ ${offers.length} ofertas da Epic Games recebidas e cache atualizado`);
      return offers;
      
    } catch (error) {
      console.error('❌ Erro ao buscar ofertas da Epic:', error);
      // Retornar cache mesmo em caso de erro, se disponível
      return cachedEpicOffers.length > 0 ? cachedEpicOffers : [];
    }
  },

  async search(query: string) {
    try {
      console.log(`🔍 Buscando na Epic por: "${query}"`);
      
      // Implementando uma busca simples baseada nos dados em cache
      if (cachedEpicOffers.length === 0) {
        await this.fetchTrending(); // Atualiza o cache se necessário
      }
      
      const normalizedQuery = query.toLowerCase();
      const results = cachedEpicOffers.filter(offer => 
        offer.title.toLowerCase().includes(normalizedQuery)
      );
      
      return results;
    } catch (error) {
      console.error('Erro na busca da Epic:', error);
      return [];
    }
  },

  async fetchByIds(ids: string[]) {
    try {
      console.log(`🆔 Buscando IDs na Epic: ${ids.join(', ')}`);
      
      // Implementando busca por IDs baseada nos dados em cache
      if (cachedEpicOffers.length === 0) {
        await this.fetchTrending(); // Atualiza o cache se necessário
      }
      
      const results = cachedEpicOffers.filter(offer => 
        ids.includes(offer.storeAppId)
      );
      
      return results;
    } catch (error) {
      console.error('Erro ao buscar por IDs na Epic:', error);
      return [];
    }
  }
}
