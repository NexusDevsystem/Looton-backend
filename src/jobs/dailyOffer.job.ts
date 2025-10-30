import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { userActivityTracker } from '../services/user-activity.service.js';
import cron from 'node-cron';

const expo = new Expo();

interface DailyOfferHistory {
  type: string;
  title: string;
  discount: number;
  price: string;
  sentTo: number;
  timestamp: string;
}

// Histórico de notificações diárias (em memória)
const dailyOfferHistory: DailyOfferHistory[] = [];

/**
 * Job que envia uma notificação diária com a melhor oferta do dia
 * Executa 2x por dia: 12h e 18h
 */
export async function runDailyOfferNotification() {
  try {
    console.log('[DailyOfferJob] Iniciando envio de Oferta do Dia...');
    
    // Detectar horário para personalizar mensagem
    const currentHour = new Date().getHours();
    const isPeakTime = currentHour >= 18; // 18h ou depois
    
    // Obter todos os usuários ativos (que usaram o app nos últimos 30 dias)
    const allUsers = userActivityTracker.getAllUsers();
    const activeUsers = allUsers.filter(user => {
      const daysSinceActive = (Date.now() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActive <= 30 && user.pushToken;
    });
    
    if (activeUsers.length === 0) {
      console.log('[DailyOfferJob] Nenhum usuário ativo com token. Pulando envio.');
      return;
    }

    // Buscar a melhor oferta do dia (maior desconto + popularidade)
    const bestOffer = await getBestOfferOfTheDay();
    
    if (!bestOffer) {
      console.log('[DailyOfferJob] Nenhuma oferta disponível hoje.');
      return;
    }

    console.log(`[DailyOfferJob] Oferta selecionada: ${bestOffer.title} - ${bestOffer.discount}% OFF`);

    // Títulos personalizados por horário
    const notificationTitle = isPeakTime 
      ? '🌟 Oferta da Noite!' 
      : '🎮 Oferta do Dia!';

    // Criar mensagens para todos os tokens válidos
    const validTokens = activeUsers
      .map(user => user.pushToken!)
      .filter(token => Expo.isExpoPushToken(token));

    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title: notificationTitle,
      body: `${bestOffer.title} - ${bestOffer.discount}% OFF por ${bestOffer.priceFormatted}`,
      data: {
        type: 'daily_offer',
        gameId: bestOffer.id,
        store: bestOffer.store,
        url: bestOffer.url
      },
      priority: 'high',
      channelId: 'daily-offers',
    }));

    console.log(`[DailyOfferJob] Enviando para ${messages.length} dispositivos...`);

    // Enviar em chunks de 100 (limite da Expo)
    const chunks = expo.chunkPushNotifications(messages);
    let totalSent = 0;
    let totalErrors = 0;

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        
        ticketChunk.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            totalErrors++;
            console.error(`[DailyOfferJob] Erro no ticket ${index}:`, ticket.message);
          }
        });

        // Rate limiting: 500ms entre chunks
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('[DailyOfferJob] Erro ao enviar chunk:', error);
        totalErrors += chunk.length;
      }
    }

    console.log(`[DailyOfferJob] Concluído! Enviadas: ${totalSent}, Erros: ${totalErrors}`);
    
    // Salvar no histórico
    dailyOfferHistory.push({
      type: 'daily_offer',
      title: bestOffer.title,
      discount: bestOffer.discount,
      price: bestOffer.priceFormatted,
      sentTo: totalSent,
      timestamp: new Date().toISOString()
    });
    
    // Manter apenas últimas 30 notificações
    if (dailyOfferHistory.length > 30) {
      dailyOfferHistory.shift();
    }

  } catch (error) {
    console.error('[DailyOfferJob] Erro fatal:', error);
  }
}

/**
 * Obter histórico de notificações diárias
 */
export function getDailyOfferHistory(): DailyOfferHistory[] {
  return dailyOfferHistory;
}

/**
 * Busca a melhor oferta do dia baseada em:
 * - Maior desconto
 * - Preço atrativo
 * - Popularidade (reviews)
 */
async function getBestOfferOfTheDay() {
  try {
    // Buscar ofertas do endpoint /deals
    const response = await fetch('http://localhost:3000/deals?limit=100');
    const deals = await response.json();

    if (!deals || deals.length === 0) {
      return null;
    }

    // Calcular score: desconto * 0.6 + (1000 / preço) * 0.4
    const scored = deals.map((deal: any) => ({
      ...deal,
      score: (deal.discount || 0) * 0.6 + (1000 / (deal.price || 999)) * 0.4
    }));

    // Ordenar por score e pegar o melhor
    scored.sort((a: any, b: any) => b.score - a.score);
    
    const best = scored[0];

    return {
      id: best.id,
      title: best.title,
      discount: best.discount || 0,
      price: best.price,
      priceFormatted: `R$ ${(best.price || 0).toFixed(2)}`,
      store: best.store || 'Steam',
      url: best.url || best.link
    };
  } catch (error) {
    console.error('[DailyOfferJob] Erro ao buscar ofertas:', error);
    return null;
  }
}

/**
 * Inicia o cron job que executa 2x por dia (12h e 18h - horário de Brasília)
 */
export function startDailyOfferJob() {
  // Executa todos os dias às 12h (meio-dia)
  cron.schedule('0 12 * * *', async () => {
    console.log('[DailyOfferJob] 🌅 Trigger às 12h (meio-dia) - executando...');
    await runDailyOfferNotification();
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // Executa todos os dias às 18h (final da tarde)
  cron.schedule('0 18 * * *', async () => {
    console.log('[DailyOfferJob] 🌆 Trigger às 18h (final da tarde) - executando...');
    await runDailyOfferNotification();
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[DailyOfferJob] Job iniciado - executará 2x por dia: 12h e 18h (horário de Brasília)');
}
