/**
 * Script de teste para verificar se os cron jobs estão sendo registrados apenas uma vez
 * Executa: node test-cron-registration.js
 */

import { startDailyOfferJob } from './dist/jobs/dailyOffer.job.js';
import { startWatchedGamesJob } from './dist/jobs/watchedGames.job.js';

console.log('=== TESTE DE REGISTRO DE CRON JOBS ===\n');

console.log('1️⃣ Primeira chamada - deve registrar os jobs:');
startDailyOfferJob();
startWatchedGamesJob();

console.log('\n2️⃣ Segunda chamada - deve ignorar (jobs já iniciados):');
startDailyOfferJob();
startWatchedGamesJob();

console.log('\n3️⃣ Terceira chamada - deve ignorar (jobs já iniciados):');
startDailyOfferJob();
startWatchedGamesJob();

console.log('\n✅ Se você viu apenas 1 mensagem de "Job iniciado" para cada job, está correto!');
console.log('❌ Se viu múltiplas mensagens, há um problema de registro duplicado.');

// Manter o processo vivo por 5 segundos para ver os logs
setTimeout(() => {
  console.log('\n🏁 Teste finalizado!');
  process.exit(0);
}, 5000);
