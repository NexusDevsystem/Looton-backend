// Script para testar notificações de reengajamento
// Simula usuário inativo e envia notificação motivacional

const BACKEND_URL = 'http://192.168.1.216:3000';
const PUSH_TOKEN = 'ExponentPushToken[WAOvqBNejtUSBB8z0q-M3D]'; // Seu token atual

async function testReengagement() {
  try {
    console.log('🧪 Testando sistema de reengajamento...\n');
    
    // 1. Registrar atividade "antiga" (simular inatividade)
    console.log('1️⃣ Registrando usuário como inativo...');
    const userId = 'test_user_' + Date.now();
    
    // Registrar atividade
    const activityRes = await fetch(`${BACKEND_URL}/notifications/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        pushToken: PUSH_TOKEN,
      }),
    });
    
    const activityResult = await activityRes.json();
    console.log('✅ Atividade registrada:', activityResult);
    
    // 2. Verificar estatísticas
    console.log('\n2️⃣ Verificando estatísticas...');
    const statsRes = await fetch(`${BACKEND_URL}/notifications/activity/stats`);
    const stats = await statsRes.json();
    console.log('📊 Estatísticas:', stats);
    
    // 3. Simular inatividade modificando manualmente (em produção isso seria feito pelo tempo)
    console.log('\n3️⃣ Para testar a notificação de reengajamento:');
    console.log('   Execute: node test-reengagement-send.js');
    console.log('   Isso enviará uma notificação motivacional imediatamente!\n');
    
    console.log('💡 Em produção, o sistema automaticamente:');
    console.log('   - Verifica usuários inativos a cada 12 horas');
    console.log('   - Envia notificações para quem não usa há 3+ dias');
    console.log('   - Limita a 1 notificação por dia por usuário');
    console.log('   - Usa mensagens motivacionais variadas (estilo Duolingo)\n');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testReengagement();
