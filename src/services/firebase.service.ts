import admin from 'firebase-admin';
import { env } from '../env.js';

// Verifica se o Firebase Admin já foi inicializado
if (!admin.apps.length) {
  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      // Importa as credenciais do Firebase como JSON
      const serviceAccount = await import(env.FIREBASE_SERVICE_ACCOUNT_PATH, { assert: { type: 'json' } });
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount.default),
      });
    } catch (error) {
      console.error('Erro ao carregar credenciais do Firebase:', error);
      console.log('Tentando inicializar sem credenciais específicas...');
      
      admin.initializeApp();
    }
  } else {
    // Se não houver arquivo de credenciais, inicializa com as configurações padrão
    admin.initializeApp();
    console.log('Firebase Admin inicializado sem arquivo de credenciais (modo desenvolvimento)');
  }
}

export { admin };