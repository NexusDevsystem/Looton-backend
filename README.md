# Looton Backend

Express + TypeScript + MongoDB (Mongoose), Redis cache and BullMQ jobs.

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

## Jobs (BullMQ)
- updateAllStores (cron via DEALS_REFRESH_CRON)
- refreshCurrency (cron via CURRENCY_REFRESH_CRON)

## Notes
- Do not commit .env
- USE_MOCK_ADAPTERS=true will serve mock data for adapters
- This backend now uses Express instead of Fastify

## Instruções rápidas (pt-BR)

1) Instalar dependências:

```powershell
npm install
```

2) Variáveis de ambiente (arquivo `.env`):

```
JWT_SECRET=uma_chave_secreta_de_desenvolvimento
MONGODB_URI=mongodb://localhost:27017/looton
```

3) Rodar em desenvolvimento:

```powershell
npm run dev
```

Observação: adicionei um arquivo temporário `src/types/custom.d.ts` para suprimir erros do TypeScript enquanto as dependências não estão instaladas. Após executar `npm install`, remova-o com:

```powershell
rm .\\src\\types\\custom.d.ts
```
