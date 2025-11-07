import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { userActivityTracker } from '../services/user-activity.service.js';
import { env } from '../env.js';
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

// Flag para prevenir execução duplicada
let isRunning = false;
let lastExecutionTime: number = 0;
const MIN_INTERVAL_MS = 60 * 1000; // Mínimo de 1 minuto entre execuções

/**
 * Job que envia uma notificação diária com a melhor oferta do dia
 * Executa 2x por dia: 12h e 18h
 */
export async function runDailyOfferNotification() {
  // Prevenir execução duplicada
  const now = Date.now();
  if (isRunning) {
    console.log('[DailyOfferJob] ⏸️ Já está executando. Ignorando chamada duplicada.');
    return;
  }
  
  if (now - lastExecutionTime < MIN_INTERVAL_MS) {
    console.log('[DailyOfferJob] ⏸️ Executou há menos de 1 minuto. Ignorando chamada duplicada.');
    return;
  }
  
  isRunning = true;
  lastExecutionTime = now;
  
  try {
    console.log('[DailyOfferJob] Iniciando envio de Oferta do Dia...');
    
    // Detectar horário para personalizar mensagem
    const currentHour = new Date().getHours();
    let notificationTitle = '🎮 Oferta do Dia!';
    
    if (currentHour >= 18) {
      notificationTitle = '🌟 Oferta da Noite!';
    } else if (currentHour >= 16) {
      notificationTitle = '☀️ Oferta da Tarde!';
    } else if (currentHour >= 12) {
      notificationTitle = '🎮 Oferta do Dia!';
    }
    
    // Obter todos os usuários ativos (que usaram o app nos últimos 30 dias)
    const allUsers = await userActivityTracker.getAllUsers();
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

    // 🔥 VALIDAÇÃO EXTRA: Garantir que a oferta tem dados válidos antes de enviar
    if (!bestOffer.title || !bestOffer.discount || !bestOffer.price || bestOffer.price === 0) {
      console.error('[DailyOfferJob] ❌ Oferta inválida detectada! Não enviando notificação.');
      console.error('[DailyOfferJob] Dados:', bestOffer);
      return;
    }

    console.log(`[DailyOfferJob] ✅ Oferta válida selecionada: ${bestOffer.title} - ${bestOffer.discount}% OFF - ${bestOffer.priceFormatted}`);

    // Criar mensagens para todos os tokens válidos
    const allTokens = activeUsers
      .map(user => user.pushToken!)
      .filter(token => Expo.isExpoPushToken(token));

    // DEDUPLICAR tokens para evitar envio duplicado
    const uniqueTokens = [...new Set(allTokens)];
    
    if (allTokens.length !== uniqueTokens.length) {
      console.warn(`[DailyOfferJob] ⚠️ Detectados ${allTokens.length - uniqueTokens.length} tokens duplicados! Enviando apenas para tokens únicos.`);
    }

    const messages: ExpoPushMessage[] = uniqueTokens.map(token => ({
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
  } finally {
    isRunning = false;
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
    // Buscar ofertas do endpoint /deals usando a URL do ambiente (Render em produção)
    const response = await fetch(`${env.API_BASE_URL}/deals?limit=100`);
    
    if (!response.ok) {
      console.error('[DailyOfferJob] Erro na API:', response.status, response.statusText);
      return null;
    }
    
    const deals = await response.json();

    if (!deals || deals.length === 0) {
      console.log('[DailyOfferJob] Nenhuma oferta retornada pela API');
      return null;
    }

    console.log(`[DailyOfferJob] Total de ofertas recebidas: ${deals.length}`);

    // Filtrar apenas ofertas válidas (com título, preço e desconto)
    const validDeals = deals.filter((deal: any) => 
      deal.game?.title && 
      deal.priceFinal && 
      deal.priceFinal > 0 && 
      deal.discountPct && 
      deal.discountPct > 0
    );

    if (validDeals.length === 0) {
      console.log('[DailyOfferJob] Nenhuma oferta válida encontrada (sem título/preço/desconto)');
      return null;
    }

    console.log(`[DailyOfferJob] Ofertas válidas: ${validDeals.length}`);

    // Calcular score: desconto * 0.6 + (1000 / preço) * 0.4
    const scored = validDeals.map((deal: any) => ({
      ...deal,
      score: (deal.discountPct || 0) * 0.6 + (1000 / (deal.priceFinal || 999)) * 0.4
    }));

    // Ordenar por score e pegar o melhor
    scored.sort((a: any, b: any) => b.score - a.score);
    
    const best = scored[0];

    console.log(`[DailyOfferJob] Melhor oferta: ${best.game.title} - ${best.discountPct}% OFF - R$ ${best.priceFinal.toFixed(2)}`);

    return {
      id: best._id || best.appId,
      title: best.game.title,
      discount: best.discountPct,
      price: best.priceFinal,
      priceFormatted: `R$ ${best.priceFinal.toFixed(2)}`,
      store: best.store?.name || 'Steam',
      url: best.url || ''
    };
  } catch (error) {
    console.error('[DailyOfferJob] Erro ao buscar ofertas:', error);
    return null;
  }
}

/**
 * Inicia o cron job que executa 2x por dia (12h e 18h - horário de Brasília)
 */
let cronJobsStarted = false;
let scheduledTasks: cron.ScheduledTask[] = [];
const jobId = Math.random().toString(36).substring(7);

export function startDailyOfferJob() {
  // Prevenir múltiplos registros do cron job
  if (cronJobsStarted) {
    console.log(`[DailyOfferJob:${jobId}] ⚠️ Jobs já iniciados. Ignorando chamada duplicada.`);
    return;
  }
  
  cronJobsStarted = true;
  console.log(`[DailyOfferJob:${jobId}] 🆔 Iniciando job com ID único: ${jobId}`);
  
  // Destruir tasks antigos se existirem
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  
  // Executa todos os dias às 12h (meio-dia)
  const task12h = cron.schedule('0 12 * * *', async () => {
    console.log(`[DailyOfferJob:${jobId}] 🌅 Trigger às 12h (meio-dia) - executando...`);
    await runDailyOfferNotification();
  }, { timezone: 'America/Sao_Paulo' });
  scheduledTasks.push(task12h);

  // Executa todos os dias às 18h (final da tarde)
  const task18h = cron.schedule('0 18 * * *', async () => {
    console.log(`[DailyOfferJob:${jobId}] 🌆 Trigger às 18h (final da tarde) - executando...`);
    await runDailyOfferNotification();
  }, { timezone: 'America/Sao_Paulo' });
  scheduledTasks.push(task18h);

  console.log(`[DailyOfferJob:${jobId}] ✅ Job iniciado - executará 2x por dia: 12h e 18h (horário de Brasília)`);
}
