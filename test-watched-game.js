const pushToken = 'ExponentPushToken[WAOvqBNejtUSBB8z0q-M3D]';

async function sendWatchedGameNotification() {
  const response = await fetch('http://localhost:3000/notifications/send-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pushToken,
      title: '🎮 Jogo Vigiado em Promoção!',
      body: 'God of War Ragnarök está 70% OFF por R$ 89,90 na Steam! Era R$ 299,90'
    })
  });
  
  const result = await response.json();
  console.log('Resultado:', result);
  
  if (result.success) {
    console.log('\n✅ Notificação de jogo vigiado enviada!');
    console.log('📨 Message ID:', result.result.data.id);
    console.log('\n📱 Verifique seu celular - deve aparecer na barra de notificações!');
  }
}

sendWatchedGameNotification();
