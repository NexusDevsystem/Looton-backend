# Looton Backend

Fastify + TypeScript + MongoDB (Mongoose), Redis cache and BullMQ jobs.

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
