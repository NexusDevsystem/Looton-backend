import { admin } from './firebase.service.js';
import { OfferDTO } from '../adapters/types.js';

interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  tokens: string[];
}

export interface NotificationRule {
  id: string;
  userId: string;
  gameId: string;
  notifyUp: boolean;
  notifyDown: boolean;
  pctThreshold: number;
  desiredPriceCents: number;
  active: boolean;
  createdAt: Date;
  lastNotifiedAt?: Date;
}

export class FirebaseNotificationService {
  static async sendPushNotifications(notification: PushNotification): Promise<boolean> {
    try {
      if (!notification.tokens || notification.tokens.length === 0) {
        console.log('Nenhum token de dispositivo fornecido para envio de notificação');
        return false;
      }

      // Envia notificações individualmente para cada token, já que sendMulticast pode não estar disponível
      const results = await Promise.allSettled(
        notification.tokens.map(token => 
          admin.messaging().send({
            token: token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: notification.data || {},
            android: {
              priority: 'high',
              notification: {
                icon: '@mipmap/ic_launcher',
                color: '#FF9800',
                sound: 'default'
              }
            },
            apns: {
              payload: {
                aps: {
                  badge: 1,
                  sound: 'default'
                }
              }
            }
          })
        )
      );

      const successfulSends = results.filter(result => result.status === 'fulfilled').length;
      const failedSends = results.filter(result => result.status === 'rejected').length;
      
      console.log(`Notificação enviada: ${successfulSends} sucesso, ${failedSends} falhas`);
      
      // Verifica se houve falhas e registra quais tokens falharam
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Falha no token ${notification.tokens[index]}:`, result.reason);
        }
      });

      return successfulSends > 0;
    } catch (error) {
      console.error('Erro ao enviar notificação via Firebase:', error);
      return false;
    }
  }

  static async sendGamePriceNotification(
    tokens: string[],
    gameTitle: string,
    currentPrice: number,
    originalPrice: number,
    discountPct: number,
    changeType: 'up' | 'down'
  ): Promise<boolean> {
    let title, body;

    if (changeType === 'down') {
      title = `🎉 Preço Baixou!`;
      body = `${gameTitle} está com ${discountPct}% de desconto! De R$${originalPrice.toFixed(2)} por R$${currentPrice.toFixed(2)}`;
    } else {
      title = `📈 Preço Subiu!`;
      body = `${gameTitle} subiu de R$${originalPrice.toFixed(2)} para R$${currentPrice.toFixed(2)}`;
    }

    const data = {
      gameId: gameTitle.toLowerCase().replace(/\s+/g, '-'),
      gameTitle,
      price: currentPrice.toString(),
      discount: discountPct.toString(),
      changeType
    };

    return this.sendPushNotifications({
      title,
      body,
      data,
      tokens
    });
  }

  static async sendDealNotification(tokens: string[], deal: OfferDTO): Promise<boolean> {
    const title = `🔥 Nova Oferta!`;
    const body = `${deal.title} está com ${deal.discountPct}% de desconto por R$${deal.priceFinal.toFixed(2)}`;
    
    const data = {
      gameId: deal.storeAppId,
      gameTitle: deal.title,
      store: deal.store,
      price: deal.priceFinal.toString(),
      discount: deal.discountPct?.toString() || '0',
      url: deal.url
    };

    return this.sendPushNotifications({
      title,
      body,
      data,
      tokens
    });
  }

  static async validateToken(token: string): Promise<boolean> {
    try {
      // Testa o token tentando enviar uma mensagem vazia (irá falhar, mas sabemos que o token é válido)
      await admin.messaging().send({
        token: token,
        data: { test: 'true' }
      });
      return true;
    } catch (error) {
      // O token é inválido se recebermos um erro específico
      const errorMessage = (error as any).message;
      if (errorMessage.includes('invalid registration token') || 
          errorMessage.includes('not found') ||
          errorMessage.includes('unregistered')) {
        return false;
      }
      // Outros erros podem ser temporários, consideramos o token como válido por enquanto
      return true;
    }
  }
}