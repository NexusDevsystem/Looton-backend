// Script de teste para notificações de jogos vigiados

async function testWatchedGames() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Iniciando teste de notificações de jogos vigiados...\n');
  
  // Passo 1: Registrar usuário no sistema de alertas (para ter pushToken no tracker)
  console.log('1️⃣ Registrando usuário de teste...');
  let userId;
  try {
    const userResponse = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@looton.com',
        pushToken: 'ExponentPushToken[test-token-12345]'
      })
    });
    const userData = await userResponse.json();
    userId = userData._doc?._id || userData._id;
    console.log('✅ Usuário registrado:', userData);
    console.log('   UserID:', userId);
  } catch (error) {
    console.log('⚠️ Erro ao registrar usuário:', error.message);
    return;
  }
  
  // Passo 2: Adicionar jogo aos favoritos
  console.log('\n2️⃣ Adicionando jogo aos favoritos...');
  try {
    const favoriteResponse = await fetch(`${baseUrl}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        gameId: '12345',
        title: 'God of War',
        desiredPrice: 99.99,
        pctThreshold: 10,
        notifyDown: true,
        stores: ['steam', 'epic']
      })
    });
    const favoriteData = await favoriteResponse.json();
    console.log('✅ Favorito adicionado:', favoriteData);
  } catch (error) {
    console.log('⚠️ Erro ao adicionar favorito:', error.message);
  }
  
  // Passo 3: Verificar favoritos cadastrados
  console.log('\n3️⃣ Verificando favoritos cadastrados...');
  try {
    const favoritesResponse = await fetch(`${baseUrl}/favorites?userId=${userId}`);
    const favorites = await favoritesResponse.json();
    console.log('✅ Favoritos do usuário:', JSON.stringify(favorites, null, 2));
  } catch (error) {
    console.log('⚠️ Erro ao buscar favoritos:', error.message);
  }
  
  // Passo 4: Verificar se o jogo tem ofertas disponíveis
  console.log('\n4️⃣ Buscando ofertas do jogo...');
  try {
    const dealsResponse = await fetch(`${baseUrl}/deals?gameId=12345`);
    const deals = await dealsResponse.json();
    console.log(`✅ Ofertas encontradas: ${deals.length}`);
    if (deals.length > 0) {
      console.log('   Primeira oferta:', {
        title: deals[0].title,
        price: deals[0].price,
        discount: deals[0].discount
      });
    } else {
      console.log('⚠️ Nenhuma oferta encontrada para este gameId');
      console.log('   Vou buscar qualquer jogo disponível...');
      
      const allDealsResponse = await fetch(`${baseUrl}/deals?limit=1`);
      const allDeals = await allDealsResponse.json();
      
      if (allDeals.length > 0) {
        const realGameId = allDeals[0].id;
        console.log(`   Usando jogo real: ${allDeals[0].title} (ID: ${realGameId})`);
        
        // Atualizar favorito com gameId real
        await fetch(`${baseUrl}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            gameId: realGameId,
            title: allDeals[0].title,
            desiredPrice: allDeals[0].price - 10, // Preço desejado abaixo do atual
            pctThreshold: 5,
            notifyDown: true,
            stores: ['steam']
          })
        });
        
        console.log(`   ✅ Favorito atualizado com jogo real`);
      }
    }
  } catch (error) {
    console.log('⚠️ Erro ao buscar ofertas:', error.message);
  }
  
  // Passo 5: Limpar cache de preços
  console.log('\n5️⃣ Limpando cache de preços...');
  try {
    const clearResponse = await fetch(`${baseUrl}/debug/clear-price-cache`, {
      method: 'POST'
    });
    const clearData = await clearResponse.json();
    console.log('✅ Cache limpo:', clearData);
  } catch (error) {
    console.log('⚠️ Erro ao limpar cache:', error.message);
  }
  
  // Passo 6: Primeira execução (cacheia preços)
  console.log('\n6️⃣ Primeira execução - cacheando preços...');
  try {
    const test1Response = await fetch(`${baseUrl}/debug/test-watched-games`, {
      method: 'POST'
    });
    const test1Data = await test1Response.json();
    console.log('✅ Resultado:', test1Data);
    console.log('   (Primeira execução apenas cacheia, não notifica)');
  } catch (error) {
    console.log('⚠️ Erro:', error.message);
  }
  
  console.log('\n⏳ Aguardando 3 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Passo 7: Segunda execução (detecta mudanças)
  console.log('7️⃣ Segunda execução - detectando mudanças...');
  try {
    const test2Response = await fetch(`${baseUrl}/debug/test-watched-games`, {
      method: 'POST'
    });
    const test2Data = await test2Response.json();
    console.log('✅ Resultado:', test2Data);
  } catch (error) {
    console.log('⚠️ Erro:', error.message);
  }
  
  // Passo 8: Verificar histórico
  console.log('\n8️⃣ Verificando histórico de notificações...');
  try {
    const historyResponse = await fetch(`${baseUrl}/debug/watched-games-history`);
    const history = await historyResponse.json();
    console.log('✅ Histórico completo:');
    console.log(JSON.stringify(history, null, 2));
    
    if (history.total > 0) {
      console.log('\n🎉 SUCESSO! Notificações foram enviadas!');
    } else {
      console.log('\n⚠️ Nenhuma notificação foi enviada ainda.');
      console.log('   Possíveis motivos:');
      console.log('   - Usuário não está no userActivityTracker');
      console.log('   - Jogo não tem ofertas disponíveis');
      console.log('   - Mudança de preço não foi significativa (< 10%)');
    }
  } catch (error) {
    console.log('⚠️ Erro ao buscar histórico:', error.message);
  }
  
  console.log('\n✅ Teste concluído!');
  console.log('\n📝 Dica: Verifique os logs do backend para mais detalhes.');
}

testWatchedGames().catch(console.error);
