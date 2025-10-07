import { connectMongo } from './src/lib/mongo.js';
import { cleanupExpiredOffers } from './src/services/cleanup-offers.service.js';

async function testCleanup() {
  console.log('Iniciando teste de limpeza de ofertas antigas...');
  
  try {
    await connectMongo();
    console.log('Conectado ao MongoDB');
    
    const count = await cleanupExpiredOffers();
    console.log(`Teste concluído: ${count} ofertas desativadas.`);
  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    process.exit(0);
  }
}

testCleanup();