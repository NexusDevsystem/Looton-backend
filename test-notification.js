const pushToken = 'ExponentPushToken[WAOvqBNejtUSBB8z0q-M3D]';

async function sendTestNotification() {
  const response = await fetch('http://localhost:3000/notifications/send-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pushToken,
      title: '🔔 Teste de Notificação',
      body: 'Esta é uma notificação de teste enviada pelo script'
    })
  });
  
  const result = await response.json();
  console.log('Resultado:', result);
}

sendTestNotification();
