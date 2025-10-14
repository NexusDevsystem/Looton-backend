import { steamAdapter } from '../adapters/steam.adapter.js';
import { updatePermanentDealsCache } from '../services/permanent-deals-cache.service.js';
import { OfferDTO } from '../adapters/types.js';

/**
 * Job para atualizar o cache de ofertas permanentes
 * Este job busca ofertas da Steam e atualiza o cache permanente
 * para garantir que sempre haja ofertas disponíveis no feed
 */
export async function runUpdatePermanentDealsCache(): Promise<void> {
  try {
    console.log('[job] Iniciando atualização do cache de ofertas permanentes...');
    
    // Busca os dados reais da Steam
    const allSteamGames = await steamAdapter.fetchTrending();
    
    console.log(`[job] Recebidos ${allSteamGames.length} jogos da Steam`);
    
    // Atualiza o cache permanente com as ofertas mais recentes
    await updatePermanentDealsCache(allSteamGames);
    
    console.log('[job] Cache de ofertas permanentes atualizado com sucesso');
  } catch (error) {
    console.error('[job] Erro ao atualizar cache de ofertas permanentes:', error);
    throw error;
  }
}

/**
 * Job para atualizar o cache de ofertas permanentes com fallback
 */
export async function runUpdatePermanentDealsCacheWithFallback(): Promise<void> {
  try {
    await runUpdatePermanentDealsCache();
  } catch (error) {
    console.error('[job] Erro no job de atualização de ofertas permanentes, tentando fallback:', error);
    
    try {
      // Tenta buscar ofertas de outro endpoint como fallback
      const dealsFallback = await steamAdapter.fetchTopSellers?.() || [];
      if (dealsFallback.length > 0) {
        await updatePermanentDealsCache(dealsFallback as OfferDTO[]);
        console.log('[job] Cache atualizado com sucesso usando fallback');
      } else {
        console.log('[job] Nenhum dado de fallback disponível');
      }
    } catch (fallbackError) {
      console.error('[job] Erro também no fallback:', fallbackError);
    }
  }
}