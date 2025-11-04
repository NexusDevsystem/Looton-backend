import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { userActivityTracker } from '../services/user-activity.service.js';
import { priceCachePersistence } from '../services/persistence/price-cache-persistence.service.js';
import { env } from '../env.js';
import cron from 'node-cron';

const expo = new Expo();

interface WatchedGameNotificationHistory {
  userId: string;
  gameId: string;
  gameTitle: string;
  oldPrice?: number | null;
  newPrice: number;
  discount: number;
  store: string;
  timestamp: string;
  notificationType: 'promotion_active' | 'new_promotion';
}

// Histórico de notificações enviadas (em memória)
const watchedGamesHistory: WatchedGameNotificationHistory[] = [];

// Cache de última verificação de preços (REMOVIDO - agora usa Redis via priceCachePersistence)
// const lastKnownPrices = new Map<string, Map<string, { price: number; discount: number }>>();

// Flag para controlar carregamento inicial
let pricesCacheLoaded = false;

/**
 * Job que monitora jogos favoritos (vigiados) dos usuários
 * 
 * Verifica A CADA 1 HORA se algum jogo da lista de observação está com desconto
 * e notifica o usuário que o jogo está pronto para comprar!
 * 
 * Executa: A cada 1 hora
 */
export async function runWatchedGamesNotification() {
  try {
    console.log('[WatchedGamesJob] 🎮 Verificando jogos vigiados (a cada 1 hora)...');
    
    // Carregar cache de preços do Redis na primeira execução
    if (!pricesCacheLoaded) {
      console.log('[WatchedGamesJob] 🔄 Carregando cache de preços do Redis...');
      pricesCacheLoaded = true;
    }
    
    // Obter todos os usuários ativos com favoritos
    const allUsers = await userActivityTracker.getAllUsers();
    console.log(`[WatchedGamesJob] Total de usuários no tracker: ${allUsers.length}`);
    
    const activeUsers = allUsers.filter(user => {
      const daysSinceActive = (Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActive <= 30 && user.pushToken;
    });
    
    if (activeUsers.length === 0) {
      console.log('[WatchedGamesJob] Nenhum usuário ativo com token.');
      console.log('[WatchedGamesJob] Dica: Usuários precisam estar no userActivityTracker com pushToken');
      return;
    }

    console.log(`[WatchedGamesJob] Verificando ${activeUsers.length} usuários ativos...`);

    // Importar dinamicamente o cache de favoritos
    let favoritesCache: Map<string, any[]>;
    try {
      const favoritesModule = await import('../routes/favorites.routes.js');
      favoritesCache = (favoritesModule as any).favoritesCache;
    } catch (error) {
      console.error('[WatchedGamesJob] Erro ao importar favoritesCache:', error);
      return;
    }

    let totalNotificationsSent = 0;
    let totalGamesChecked = 0;

    // Para cada usuário ativo
    for (const user of activeUsers) {
      const userFavorites = favoritesCache.get(user.userId) || [];
      
      if (userFavorites.length === 0) {
        continue;
      }

      console.log(`[WatchedGamesJob] Usuário ${user.userId}: ${userFavorites.length} favoritos`);
      totalGamesChecked += userFavorites.length;

      // Para cada jogo favorito do usuário
      for (const favorite of userFavorites) {
        try {
          // Buscar ofertas atuais do jogo
          const currentOffers = await fetchGameOffers(favorite.gameId);
          
          if (!currentOffers || currentOffers.length === 0) {
            continue;
          }

          // Verificar se houve mudança significativa
          const notification = await checkForPriceChange(user.userId, favorite, currentOffers);
          
          if (notification) {
            // Enviar notificação push
            const sent = await sendWatchedGameNotification(user.pushToken!, notification);
            
            if (sent) {
              totalNotificationsSent++;
              
              // Salvar no histórico
              watchedGamesHistory.push({
                userId: user.userId,
                gameId: favorite.gameId,
                gameTitle: notification.gameTitle,
                oldPrice: notification.oldPrice,
                newPrice: notification.newPrice,
                discount: notification.discount,
                store: notification.store,
                timestamp: new Date().toISOString(),
                notificationType: notification.type
              });
            }

            // Rate limiting: 200ms entre notificações
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`[WatchedGamesJob] Erro ao verificar jogo ${favorite.gameId}:`, error);
        }
      }
    }

    console.log(`[WatchedGamesJob] ✅ Concluído! Jogos verificados: ${totalGamesChecked}, Notificações enviadas: ${totalNotificationsSent}`);
    
    // Limpar histórico antigo (manter últimas 100)
    if (watchedGamesHistory.length > 100) {
      watchedGamesHistory.splice(0, watchedGamesHistory.length - 100);
    }

  } catch (error) {
    console.error('[WatchedGamesJob] Erro fatal:', error);
  }
}

/**
 * Busca ofertas atuais de um jogo
 */
async function fetchGameOffers(gameId: string) {
  try {
    const response = await fetch(`${env.API_BASE_URL}/deals?gameId=${gameId}`);
    
    if (!response.ok) {
      return null;
    }
    
    const deals = await response.json();
    return deals;
  } catch (error) {
    console.error(`[WatchedGamesJob] Erro ao buscar ofertas do jogo ${gameId}:`, error);
    return null;
  }
}

/**
 * Verifica se houve mudança de preço significativa
 */
async function checkForPriceChange(userId: string, favorite: any, currentOffers: any[]) {
  const gameKey = `${favorite.gameId}`;
  
  // Encontrar melhor oferta atual (maior desconto ou menor preço)
  const bestOffer = currentOffers.reduce((best, offer) => {
    const currentScore = (offer.discount || 0) * 100 + (1000 / (offer.price || 999));
    const bestScore = (best.discount || 0) * 100 + (1000 / (best.price || 999));
    return currentScore > bestScore ? offer : best;
  }, currentOffers[0]);

  if (!bestOffer) {
    return null;
  }

  // Obter preço e desconto conhecidos anteriormente do Redis
  const lastKnown = await priceCachePersistence.load(userId, gameKey);
  
  // 🔥 LÓGICA SIMPLES: Se o jogo tem desconto AGORA, verificar se já notificamos
  const currentDiscount = bestOffer.discount || 0;
  
  // Atualizar cache com valores atuais
  await priceCachePersistence.save(userId, gameKey, {
    price: bestOffer.price,
    discount: currentDiscount
  });
  
  // ❌ Se NÃO há desconto, não notificar
  if (currentDiscount === 0) {
    return null;
  }
  
  // ✅ TEM DESCONTO! Verificar se já notificamos antes
  
  // Se é primeira verificação OU se antes NÃO tinha desconto → NOTIFICAR!
  if (!lastKnown || lastKnown.discount === 0) {
    return {
      gameTitle: favorite.title || bestOffer.title,
      gameId: favorite.gameId,
      oldPrice: lastKnown?.price || null,
      newPrice: bestOffer.price,
      discount: currentDiscount,
      store: bestOffer.store || 'Steam',
      url: bestOffer.url || bestOffer.link,
      type: 'new_promotion' as const
    };
  }
  
  // Se JÁ tinha desconto antes, não notificar de novo (evitar spam)
  return null;
}

/**
 * Envia notificação push para o usuário
 */
async function sendWatchedGameNotification(pushToken: string, notification: any): Promise<boolean> {
  try {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error('[WatchedGamesJob] Token inválido:', pushToken);
      return false;
    }

    let title = '';
    let body = '';

    switch (notification.type) {
      case 'promotion_active':
      case 'new_promotion':
        // Jogo vigiado está com desconto!
        title = '🔥 Promoção Detectada!';
        body = `${notification.gameTitle} está com ${notification.discount}% OFF - R$ ${notification.newPrice.toFixed(2)} - Pronto pra comprar!`;
        break;
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: 'watched_game',
        gameId: notification.gameId,
        store: notification.store,
        url: notification.url,
        notificationType: notification.type
      },
      priority: 'high',
      channelId: 'watched-games',
    };

    const tickets = await expo.sendPushNotificationsAsync([message]);
    
    if (tickets[0].status === 'ok') {
      console.log(`[WatchedGamesJob] ✅ Notificação enviada: ${notification.gameTitle}`);
      return true;
    } else {
      console.error(`[WatchedGamesJob] ❌ Erro ao enviar notificação:`, tickets[0]);
      return false;
    }

  } catch (error) {
    console.error('[WatchedGamesJob] Erro ao enviar notificação push:', error);
    return false;
  }
}

/**
 * Obter histórico de notificações de jogos vigiados
 */
export function getWatchedGamesHistory(): WatchedGameNotificationHistory[] {
  return watchedGamesHistory;
}

/**
 * Limpar cache de preços (útil para testes)
 */
export async function clearPriceCache() {
  await priceCachePersistence.clear();
  console.log('[WatchedGamesJob] Cache de preços limpo no Redis');
}

/**
 * Inicia o cron job que executa A CADA 1 HORA
 */
export function startWatchedGamesJob() {
  // Executa A CADA 1 HORA
  cron.schedule('0 * * * *', async () => {
    console.log('[WatchedGamesJob] ⏰ Verificação automática (a cada 1h)...');
    await runWatchedGamesNotification();
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[WatchedGamesJob] ✅ Job iniciado - executará A CADA 1 HORA (horário de Brasília)');
  
  // Executar imediatamente na primeira vez (útil para testes)
  // Comentar em produção se não quiser execução imediata
  // setTimeout(() => runWatchedGamesNotification(), 5000);
}
