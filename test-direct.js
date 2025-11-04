// Teste simplificado - importar diretamente e executar

import { userActivityTracker } from './src/services/user-activity.service.ts';
import { favoritesCache } from './src/routes/favorites.routes.ts';
import { runWatchedGamesNotification } from './src/jobs/watchedGames.job.ts';

async function testDirect() {
  console.log('🧪 Teste Direto de Notificações\n');
  
  // 1. Registrar usuário no tracker
  console.log('1️⃣ Registrando usuário no tracker...');
  const userId = 'test_direct_user_123';
  const pushToken = 'ExponentPushToken[test-direct-token]';
  userActivityTracker.recordActivity(userId, pushToken);
  
  const allUsers = userActivityTracker.getAllUsers();
  console.log(`✅ Usuários no tracker: ${allUsers.length}`);
  console.log('   Usuário:', allUsers[0]);
  
  // 2. Adicionar favorito
  console.log('\n2️⃣ Adicionando favorito...');
  const favorite = {
    _id: 'fav_test_123',
    userId: userId,
    gameId: '666666', // ID de um jogo qualquer
    title: 'Test Game',
    stores: ['steam'],
    notifyDown: true,
    pctThreshold: 5,
    desiredPrice: 50,
    createdAt: new Date()
  };
  
  favoritesCache.set(userId, [favorite]);
  console.log(`✅ Favorito adicionado ao cache`);
  console.log('   Favoritos do usuário:', favoritesCache.get(userId));
  
  // 3. Executar job
  console.log('\n3️⃣ Executando job de watched games...\n');
  await runWatchedGamesNotification();
  
  console.log('\n✅ Teste concluído!');
}

testDirect().catch(console.error);
