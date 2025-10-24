// Script para testar notificações push
import('dotenv').then(d => d.config());
const { sendPush } = await import('./dist/services/notification.service.js');

async function testPushNotification() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node test-push.js <expo_push_token> <title> <body>');
    process.exit(1);
  }

  const [expoPushToken, title, body] = args;
  
  console.log(`Sending push notification...`);
  console.log(`Token: ${expoPushToken.substring(0, 20)}...`);
  console.log(`Title: ${title}`);
  console.log(`Body: ${body}`);

  try {
    const result = await sendPush(expoPushToken, title, body, { 
      test: true,
      timestamp: Date.now()
    });
    
    console.log(`Push notification result: ${result ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('Error sending push notification:', error.message);
  }
}

testPushNotification().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});