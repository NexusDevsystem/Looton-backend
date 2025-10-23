# Looton Backend

Fastify + TypeScript + Redis cache and BullMQ jobs (sem banco de dados persistente).

## Setup

1. Copy env:

cp .env.example .env

2. Install and run (Node 20+):

npm i
npm run dev

3. Redis (optional for cache):

docker compose up -d

## Routes

- GET /health
- GET /deals?minDiscount=&limit=
- GET /search?q=&stores=steam,epic
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

## Instruções rápidas (pt-BR)

1) Instalar dependências:

```powershell
npm install
```

2) Variáveis de ambiente (arquivo `.env`):

```
# Não é necessário mais variáveis de autenticação
```

3) Rodar em desenvolvimento:

```powershell
npm run dev
```

Observação: adicionei um arquivo temporário `src/types/custom.d.ts` para suprimir erros do TypeScript enquanto as dependências não estão instaladas. Após executar `npm install`, remova-o com:

```powershell
rm .\\src\\types\\custom.d.ts
```