// Script para enviar notificação de reengajamento manualmente
// Útil para testar as mensagens motivacionais

const PUSH_TOKEN = 'ExponentPushToken[WAOvqBNejtUSBB8z0q-M3D]'; // Seu token atual

// Mensagens motivacionais estilo Duolingo - tom casual e amigável
const messages = [
  {
    title: '🎮 Eii, perdeu a vontade de jogar?',
    body: 'Tem novos jogos pra você! Ofertas incríveis chegaram 🔥',
  },
  {
    title: '💎 Opa, sumiu foi?',
    body: 'Tem jogos com desconto histórico te esperando aqui!',
  },
  {
    title: '🏆 Ei, tá fazendo o quê?',
    body: 'Seus jogos favoritos tão em promoção. Dá uma olhada! 👀',
  },
  {
    title: '🎯 Eii, volta aqui!',
    body: 'Novos jogos todo dia esperando por você. Bora conferir?',
  },
  {
    title: '⚡ Psiu, esqueceu de mim?',
    body: 'Ofertas relâmpago rolando agora. Corre que tá acabando!',
  },
  {
    title: '🔥 Ei, tá perdendo hein!',
    body: 'Os maiores descontos da semana estão aqui. Vem ver!',
  },
  {
    title: '🎁 Ô, tem presente pra você!',
    body: 'Jogos AAA com preço de banana. Sério, vem ver isso!',
  },
  {
    title: '🌟 Ei, cadê você?',
    body: 'Tá perdendo jogos com até 95% OFF. Volta logo!',
  },
];

async function sendReengagementNotification() {
  try {
    // Escolher mensagem aleatória
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    console.log('📨 Enviando notificação de reengajamento...');
    console.log(`   Título: ${message.title}`);
    console.log(`   Mensagem: ${message.body}\n`);
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: PUSH_TOKEN,
        sound: 'default',
        title: message.title,
        body: message.body,
        priority: 'high',
        channelId: 'reengagement',
        data: {
          type: 'reengagement',
          experienceId: '@nyill/looton-app',
        },
        badge: 1,
        android: {
          sound: 'default',
          priority: 'max',
          vibrate: [0, 250, 250, 250],
        },
      }),
    });
    
    const result = await response.json();
    
    if (result.data?.status === 'ok' || result.data?.id) {
      console.log('✅ Notificação enviada com sucesso!');
      console.log('📋 Resposta:', JSON.stringify(result, null, 2));
      console.log('\n🔔 Verifique seu dispositivo agora!');
    } else {
      console.error('❌ Erro ao enviar notificação:', result);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

sendReengagementNotification();
