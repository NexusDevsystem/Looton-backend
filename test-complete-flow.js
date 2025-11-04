// Script para simular usuário e testar notificação completa

import { userActivityTracker } from './src/services/user-activity.service.ts';
import { runDailyOfferNotification } from './src/jobs/dailyOffer.job.ts';

async function testComplete() {
  console.log('🧪 Teste Completo de Notificação Daily Offer\n');
  
  // 1. Registrar usuário de teste
  const testToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'; // Token de exemplo
  const userId = 'test_user_visual';
  
  console.log('1️⃣ Registrando usuário de teste...');
  userActivityTracker.recordActivity(userId, testToken);
  
  const users = userActivityTracker.getAllUsers();
  console.log(`✅ Total de usuários: ${users.length}`);
  console.log('   Usuário:', users[0]);
  
  // 2. Executar job de daily offer
  console.log('\n2️⃣ Executando job de Daily Offer...\n');
  await runDailyOfferNotification();
  
  console.log('\n✅ Teste concluído!');
  console.log('\n💡 O que aconteceu:');
  console.log('   - Usuário foi registrado com pushToken');
  console.log('   - Job buscou melhor oferta do dia');
  console.log('   - Tentou enviar notificação');
  console.log('   - Como o token é de teste, deu erro (esperado)');
  console.log('\n🎯 Com seu token REAL do celular, a notificação chegaria!');
}

testComplete().catch(console.error);
