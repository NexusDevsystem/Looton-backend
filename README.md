# Looton Backend

Express + TypeScript + MongoDB (Mongoose), Redis cache, BullMQ jobs, Firebase Push Notifications and Analytics.

## Setup

1. Copy env and fill Mongo:

cp .env.example .env

Set MONGODB_URI and keep MONGODB_DBNAME=Looton.

2. Install and run (Node 20+):

npm i
npm run dev

3. Redis (optional for cache):

docker compose up -d

## Routes

- GET /health
- GET /deals?minDiscount=&limit=
- GET /search?q=&stores=steam (Epic temporariamente desativada para melhorias)
- GET /games/:id/offers
- GET /games/:id/history
- POST /users
- POST /alerts
- GET /alerts?userId=
- DELETE /alerts/:id
- POST /notify/test

## Firebase Push Notifications Routes
- POST /notifications/register-token - Registra token de dispositivo para notificações push
- POST /notifications/remove-token - Remove token de dispositivo
- GET /notifications/tokens/:userId - Obtém tokens válidos de um usuário

## Analytics Routes
- POST /analytics/event - Envia evento de analytics do app
- GET /analytics/metrics - Obtém métricas de uso (requer autenticação)
- GET /analytics/users - Obtém dados de usuários (requer autenticação)

## Jobs (BullMQ)
- updateAllStores (cron via DEALS_REFRESH_CRON)
- refreshCurrency (cron via CURRENCY_REFRESH_CRON)

## Firebase Integration
- **Firebase Project ID**: looton-a2877
- **Firebase App ID**: 1:464064480689:android:bfa938a4b94c4b44b86990
- **Android Package**: com.nexusdevsystem.looton
- **FCM Server Key**: Configurado via variável de ambiente FCM_SERVER_KEY

### Push Notifications Features:
- Register/unregister device tokens
- Send price change notifications
- Send deal notifications
- Token validation and cleanup
- Multi-device notification support

## Analytics Features
- Event tracking from app
- User metrics and demographics
- Request analytics
- Active user tracking (daily, weekly, monthly)
- Popular endpoints tracking
- Session duration analytics

### Analytics Metrics Available:
- Total requests
- Active users (daily, weekly, monthly)
- New users
- Top events
- Most popular endpoints
- User retention rates
- User distribution by country
- Average session duration

## Notes
- Do not commit .env
- USE_MOCK_ADAPTERS=true will serve mock data for adapters
- This backend now uses Fastify instead of Express
- FCM_SERVER_KEY is required for push notifications
- ANALYTICS_API_KEY is required for accessing analytics data
- Analytics data is stored in-memory (for production, implement database storage)

## Instruções rápidas (pt-BR)

1) Instalar dependências:

```powershell
npm install
```

2) Variáveis de ambiente (arquivo `.env`):

```
JWT_SECRET=uma_chave_secreta_de_desenvolvimento
MONGODB_URI=mongodb://localhost:27017/looton
FCM_SERVER_KEY=72HFzbtSTbGHZbVOYAxs6A
ANALYTICS_API_KEY=analytics_key_looton_2025
```

3) Rodar em desenvolvimento:

```powershell
npm run dev
```

Observação: adicionei um arquivo temporário `src/types/custom.d.ts` para suprimir erros do TypeScript enquanto as dependências não estão instaladas. Após executar `npm install`, remova-o com:

```powershell
rm .\\src\\types\\custom.d.ts
```
