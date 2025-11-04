// Script para testar notificação push real no celular

import { Expo } from 'expo-server-sdk';

const expo = new Expo();

async function sendTestNotification() {
  console.log('📱 Teste de Notificação Push\n');
  
  // IMPORTANTE: Substitua pelo seu token real do Expo
  // Você pode obter isso abrindo o app no celular e verificando os logs
  const pushToken = process.argv[2] || 'COLOQUE_SEU_TOKEN_AQUI';
  
  if (pushToken === 'COLOQUE_SEU_TOKEN_AQUI') {
    console.log('❌ ERRO: Você precisa fornecer um push token válido!\n');
    console.log('Como obter seu push token:');
    console.log('1. Abra o app Looton no seu celular');
    console.log('2. Vá para as configurações/perfil');
    console.log('3. O token será exibido nos logs do console');
    console.log('4. Ou verifique os logs do Metro bundler\n');
    console.log('Uso:');
    console.log('  node test-push.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]\n');
    return;
  }
  
  // Verificar se o token é válido
  if (!Expo.isExpoPushToken(pushToken)) {
    console.log('❌ ERRO: Token inválido!');
    console.log('   O token deve começar com: ExponentPushToken[');
    console.log('   Token fornecido:', pushToken);
    return;
  }
  
  console.log('✅ Token válido:', pushToken.substring(0, 30) + '...\n');
  
  // Criar mensagens de teste
  const messages = [
    {
      to: pushToken,
      sound: 'default',
      title: '🎯 Teste: Preço Desejado Alcançado!',
      body: 'God of War agora está por R$ 89.99!',
      data: {
        type: 'watched_game',
        gameId: '12345',
        store: 'Steam',
        notificationType: 'desired_price_reached'
      },
      priority: 'high',
      channelId: 'watched-games',
    },
    {
      to: pushToken,
      sound: 'default',
      title: '💰 Teste: Preço Caiu!',
      body: 'Elden Ring de R$ 199.99 → R$ 139.99 (-30%)',
      data: {
        type: 'watched_game',
        gameId: '67890',
        store: 'Steam',
        notificationType: 'price_drop'
      },
      priority: 'high',
      channelId: 'watched-games',
    },
    {
      to: pushToken,
      sound: 'default',
      title: '🔥 Teste: Novo Desconto!',
      body: 'Cyberpunk 2077 agora com 60% OFF - R$ 79.99',
      data: {
        type: 'watched_game',
        gameId: '11111',
        store: 'Epic',
        notificationType: 'new_discount'
      },
      priority: 'high',
      channelId: 'watched-games',
    },
    {
      to: pushToken,
      sound: 'default',
      title: '🎮 Teste: Oferta do Dia!',
      body: 'Red Dead Redemption 2 - 70% OFF por R$ 59.99',
      data: {
        type: 'daily_offer',
        gameId: '22222',
        store: 'Steam',
      },
      priority: 'high',
      channelId: 'daily-offers',
    }
  ];
  
  console.log('📤 Enviando 4 notificações de teste...\n');
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    try {
      console.log(`${i + 1}. Enviando: ${message.title}`);
      
      const tickets = await expo.sendPushNotificationsAsync([message]);
      
      if (tickets[0].status === 'ok') {
        console.log('   ✅ Enviada com sucesso!');
        console.log('   ID:', tickets[0].id);
      } else if (tickets[0].status === 'error') {
        console.log('   ❌ Erro:', tickets[0].message);
        console.log('   Detalhes:', tickets[0].details);
      }
      
      // Aguardar 2 segundos entre notificações
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.log('   ❌ Erro ao enviar:', error.message);
    }
  }
  
  console.log('\n✅ Teste concluído!');
  console.log('\n📱 Verifique seu celular agora!');
  console.log('   As notificações devem aparecer mesmo com o app fechado.\n');
  
  console.log('💡 Dica: Se não recebeu as notificações, verifique:');
  console.log('   1. Permissões de notificação estão habilitadas no app');
  console.log('   2. Token está correto e ativo');
  console.log('   3. Celular está conectado à internet');
  console.log('   4. App foi compilado com as configurações corretas de push\n');
}

sendTestNotification().catch(console.error);
