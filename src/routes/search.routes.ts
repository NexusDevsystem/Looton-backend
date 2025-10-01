import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { fetchSteamAppPrice } from '../services/steam-api.service.js'
import { epicAdapter } from '../adapters/epic.adapter.js'
import { gogAdapter } from '../adapters/gog.adapter.js'

export default async function searchRoutes(app: FastifyInstance) {
  // /search - aggregated adapter search (NO DB filtering/persistence)
  app.get('/search', async (req: any, reply: any) => {
    console.log('Query recebida:', req.query);
    console.log('Body recebido:', req.body);

    const schema = z.object({ 
      q: z.string().min(1), 
      stores: z.string().optional(),
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(200).optional()
    })

    try {
      const { q, stores, page, limit } = schema.parse(req.query)
      const storeList = stores ? stores.split(',').map((s: string) => s.trim()) : undefined

      const adapters: Record<string, any> = {
        steam: steamAdapter,
        epic: epicAdapter,
        gog: gogAdapter
      }

      const list = storeList && storeList.length ? storeList : Object.keys(adapters)

      const results: any[] = []
      for (const s of list) {
        const adapter = adapters[s]
        if (!adapter) continue
        try {
          let items = await adapter.search(q)
          // Some adapter endpoints return { games: [...] } (DB-style); normalize to array
          if (items && !Array.isArray(items) && Array.isArray(items.games)) {
            items = items.games
          }
          console.log(`Resultados do adaptador ${s}:`, items);
          results.push(...(items || []))
        } catch (err) {
          console.error(`Erro no adapter ${s} durante search:`, err)
        }
      }

      console.log('Resultados antes da deduplicação:', results);

      // Normalize keys for deduplication and ensure no missing identifiers
      const normalized: any[] = results.map((it, idx) => {
        const store = it.store || (it.storeName || it.store?.name) || 'unknown'
        const storeAppId = (it.storeAppId || it.id || it.appid || it.packageid || it.bundleid || String(it._id) || String(idx))
        return { ...it, store, storeAppId }
      })

      // Deduplicate by store + storeAppId/title with safe fallback
      const seen = new Set<string>()
      const deduped: any[] = []
      try {
        for (const it of normalized) {
          const key = `${it.store}:${it.storeAppId || it.title}`
          if (seen.has(key)) continue
          seen.add(key)
          deduped.push(it)
        }
      } catch (e) {
        // If deduplication fails for any reason, fallback to normalized results
        console.error('Erro durante deduplicação, retornando resultados normalizados:', e)
        const lim = limit || 50
        return reply.send(normalized.slice(0, lim))
      }

      console.log('Resultados agregados normalizados:', normalized.length, 'items')
      console.log('Resultados deduplicados:', deduped.length, 'items')

      const lim = limit || 50

      // Try to enrich steam items with real prices (limit to avoid heavy load)
      const finalSlice = deduped.slice(0, lim)
      try {
        const maxFetch = 8
        let fetched = 0
        for (let i = 0; i < finalSlice.length && fetched < maxFetch; i++) {
          const it = finalSlice[i]
          if (!it) continue
          const store = (it.store || '').toLowerCase()
          if (store === 'steam') {
            const idNum = parseInt(String(it.storeAppId || it.id || ''), 10)
            if (!Number.isNaN(idNum)) {
              try {
                const priceData = await fetchSteamAppPrice(idNum)
                if (priceData) {
                  it.priceBase = (priceData.priceBaseCents || 0) / 100
                  it.priceFinal = (priceData.priceFinalCents || 0) / 100
                  it.discountPct = priceData.discountPct || 0
                }
              } catch (e) {
                console.error('Erro ao enriquecer preço Steam para', idNum, e)
              }
              fetched++
            }
          }
        }
      } catch (e) {
        console.error('Erro ao tentar enriquecer preços:', e)
      }

      // Fallback: se não houver resultados, tente buscar diretamente na Steam
      if ((deduped.length === 0 || normalized.length === 0) && adapters.steam) {
        try {
          console.log('Nenhum resultado agregado — tentando fallback direto na Steam')
          const steamItems = await adapters.steam.search(q)
          const fallback = (steamItems || []).map((it: any, idx: number) => ({
            ...it,
            store: it.store || 'steam',
            storeAppId: it.storeAppId || it.id || String(it.appid) || String(idx)
          }))
          return reply.send(fallback.slice(0, lim))
        } catch (e) {
          console.error('Erro no fallback Steam:', e)
        }
      }

      return reply.send(finalSlice)
    } catch (err) {
      console.error('Erro na rota /search (direct adapters):', err)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
