# Epic Free Games - Details API

This module provides enriched data for Epic Games free promotions by combining the public freeGamesPromotions feed with the product page content.

Endpoints

- `GET /api/v1/epic/free/full`
  - Returns a list of free promo items enriched with images (feed + store-content) and extracted system requirements when available.
  - Response: `{ items: [...], count }`
  - Header: `X-Data-Source: epic:freeGamesPromotions+store-content`

- `GET /api/v1/epic/free/full/:id`
  - Returns a single enriched item by `offerId` or derived id.

Caching & resilience

- Both the feed and store-content calls use an in-memory cache (10 min TTL).
- HTTP calls use a 6s timeout and exponential retry up to 3 attempts.
- Locale fallback: the store-content is requested first with `pt-BR`, then `en-US` if the first fails or yields no content.

Frontend integration

- When tapping an Epic card in the app, call `/api/v1/epic/free/full/:id` to obtain `images[]`, `requirements[]` and `storeUrl`.
- Use `images[]` for the carousel, `requirements` to populate the "Requisitos mínimos" block, and `storeUrl` for the "Acessar loja oficial" button.
