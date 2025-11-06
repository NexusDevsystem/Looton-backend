import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'
import { listFreeGames } from '../integrations/epic/freeGames.js'
import { filterNSFWGames } from '../utils/nsfw-shield.js'


// Cache de busca por cc|l|q por 5 minutos
const cache = new MemoryCache<string, any[]>(ttlSecondsToMs(300))

function ck(cc: string, l: string, q: string) {
  return `${cc}|${l}|${q}`.toLowerCase()
}

function normalizeLocale(l?: string): string {
  if (!l) return 'pt-BR'
  return l
}

function normalizeCC(cc?: string): string {
  return (cc || 'BR').toUpperCase()
}

function isTextMatchScore(q: string, title: string) {
  const a = q.trim().toLowerCase()
  const b = (title || '').trim().toLowerCase()
  if (!a || !b) return 0
  if (a === b) return 2
  if (b.startsWith(a)) return 1
  return 0
}

async function fetchJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) return undefined
  return res.json()
}

async function enrichApp(appid: number, cc: string, l: string) {
  const data = await fetchJson(`https://store.steampowered.com/api/appdetails/?appids=${appid}&cc=${cc}&l=${l}`)
  const node = data?.[String(appid)]
  if (!node?.success) return undefined
  const d = node.data
  const type = (d?.type as string) || 'game'
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/app/${appid}/`
  const pov = d?.price_overview
  
  // Extract genres/categories from Steam API
  const genres = (d?.genres || []).map((g: any) => g?.description || '').filter(Boolean)
  const categories = (d?.categories || []).map((c: any) => c?.description || '').filter(Boolean)
  const allTags = [...new Set([...genres, ...categories])]

  if (type === 'game') {
    if (d?.is_free || !pov) {
      return { id: `app:${appid}`, kind: 'game', title, image: header, currency: pov?.currency, priceOriginalCents: null, priceFinalCents: null, discountPct: null, tags: allTags }
    }
    const initial = typeof pov.initial === 'number' ? pov.initial : null
    const discount = typeof pov.discount_percent === 'number' ? pov.discount_percent : null
    const final = typeof pov.final === 'number' ? pov.final : (initial !== null && discount !== null ? Math.round(initial * (100 - discount) / 100) : null)
    return { id: `app:${appid}`, kind: 'game', title, image: header, currency: pov?.currency, priceOriginalCents: initial, priceFinalCents: final, discountPct: discount, tags: allTags }
  }

  if (type === 'dlc') {
    if (!pov) {
      return { id: `app:${appid}`, kind: 'dlc', title, image: header, currency: null, priceOriginalCents: null, priceFinalCents: null, discountPct: null, tags: allTags }
    }
    const initial = typeof pov.initial === 'number' ? pov.initial : null
    const discount = typeof pov.discount_percent === 'number' ? pov.discount_percent : null
    const final = typeof pov.final === 'number' ? pov.final : (initial !== null && discount !== null ? Math.round(initial * (100 - discount) / 100) : null)
    return { id: `app:${appid}`, kind: 'dlc', title, image: header, currency: pov?.currency, priceOriginalCents: initial, priceFinalCents: final, discountPct: discount, tags: allTags }
  }

  // Outros tipos tratados como game (sem preço se ausente)
  if (!pov) {
    return { id: `app:${appid}`, kind: 'game', title, image: header, currency: null, priceOriginalCents: null, priceFinalCents: null, discountPct: null, tags: allTags }
  }
  return { id: `app:${appid}`, kind: 'game', title, image: header, currency: pov?.currency, priceOriginalCents: pov.initial ?? null, priceFinalCents: pov.final ?? null, discountPct: pov.discount_percent ?? null, tags: allTags }
}

export default async function searchRoutes(app: FastifyInstance) {
  // /search - Leve e confiável (Steam-only), com paginação e cache
  app.get('/search', async (req: any, reply: any) => {
    const schema = z.object({
      q: z.string().min(2),
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(50).optional(),
      cc: z.string().length(2).optional(),
      l: z.string().optional(),
    })

    try {
      const { q, page, limit, cc: ccRaw, l: lRaw } = schema.parse(req.query)
      const cc = normalizeCC(ccRaw)
      const l = normalizeLocale(lRaw)
      const pageNum = page || 1
      const pageSize = limit || 20

      const cacheKey = ck(cc, l, q)
      const cached = cache.get(cacheKey)
      if (cached && cached.length) {
        const start = (pageNum - 1) * pageSize
        return reply.send(cached.slice(start, start + pageSize))
      }

      // 1) Buscar candidatos leves via storesearch
      const term = encodeURIComponent(q.trim())
      const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${term}&cc=${cc}&l=${encodeURIComponent(l)}`
      const data: any = await fetchJson(searchUrl)
      let items: any[] = Array.isArray(data?.items) ? data.items : []

      // Fallback: steamcommunity SearchApps se vazio
      if (!items.length) {
        const comm = await fetchJson(`https://steamcommunity.com/actions/SearchApps/${term}`)
        if (Array.isArray(comm)) {
          items = comm.map((x: any) => ({ id: x.appid, name: x.name }))
        }
      }

      if (!items.length) return reply.send([])

      // 2) Enriquecer somente os que vão ser exibidos (primeira página + próximos 20)
      const maxEnrich = Math.min(items.length, pageSize + 20)
      const slice = items.slice(0, maxEnrich)

      // Limite de concorrência: 8
      const conc = 8
      const out: any[] = []
      let idx = 0
      await Promise.all(Array.from({ length: conc }).map(async () => {
        while (idx < slice.length) {
          const i = idx++
          const it = slice[i]
          const appid = Number(it?.id)
          if (!Number.isFinite(appid)) continue
          try {
            const n = await enrichApp(appid, cc, l)
            if (n) out.push(n)
          } catch (e) {
            // log e segue
          }
        }
      }))

      // 3) Dedup por id
      const uniq = new Map<string, any>()
      for (const x of out) {
        if (!uniq.has(x.id)) uniq.set(x.id, x)
      }
      let enriched = Array.from(uniq.values())
      
      // Filtrar conteúdo impróprio com NSFW Shield
      enriched = filterNSFWGames(enriched)
      console.log(`🛡️ Search filtrado: ${enriched.length} resultados seguros`)

      // 4) Ordenação: match texto desc (exato > prefixo > resto), depois desconto desc, depois menor preço final
      const qLower = q.trim().toLowerCase()
      enriched.sort((a, b) => {
        const sa = isTextMatchScore(qLower, a.title)
        const sb = isTextMatchScore(qLower, b.title)
        if (sb !== sa) return sb - sa
        const da = typeof a.discountPct === 'number' ? a.discountPct : -1
        const db = typeof b.discountPct === 'number' ? b.discountPct : -1
        if (db !== da) return db - da
        const fa = typeof a.priceFinalCents === 'number' ? a.priceFinalCents : Number.MAX_SAFE_INTEGER
        const fb = typeof b.priceFinalCents === 'number' ? b.priceFinalCents : Number.MAX_SAFE_INTEGER
        return fa - fb
      })

      // 5) Cache curto (não cachear vazio)
      if (enriched.length) cache.set(cacheKey, enriched)

      // 6) Incluir jogos da Epic Games na busca
      try {
        const epicDeals = await listFreeGames(l, cc, cc);
        const epicMatches = epicDeals.filter(deal => 
          deal.title.toLowerCase().includes(qLower)
        ).map(deal => ({
          id: deal.id,
          kind: deal.kind,
          title: deal.title,
          image: deal.coverUrl,
          currency: deal.currency,
          priceOriginalCents: deal.stores[0]?.priceBase ? Math.round(deal.stores[0].priceBase * 100) : null,
          priceFinalCents: deal.stores[0]?.priceFinal ? Math.round(deal.stores[0].priceFinal * 100) : null,
          discountPct: deal.stores[0]?.discountPct,
          tags: deal.tags
        }));
        
        // Combinar resultados da Steam com da Epic Games
        const combinedResults = [...enriched, ...epicMatches];
        
        // Remover duplicados pelos IDs
        const uniqueResults = new Map<string, any>();
        for (const item of combinedResults) {
          if (!uniqueResults.has(item.id)) {
            uniqueResults.set(item.id, item);
          }
        }
        
        const allResults = Array.from(uniqueResults.values());
        
        // Reordenar os resultados combinados
        allResults.sort((a, b) => {
          const sa = isTextMatchScore(qLower, a.title);
          const sb = isTextMatchScore(qLower, b.title);
          if (sb !== sa) return sb - sa;
          const da = typeof a.discountPct === 'number' ? a.discountPct : -1;
          const db = typeof b.discountPct === 'number' ? b.discountPct : -1;
          if (db !== da) return db - da;
          const fa = typeof a.priceFinalCents === 'number' ? a.priceFinalCents : Number.MAX_SAFE_INTEGER;
          const fb = typeof b.priceFinalCents === 'number' ? b.priceFinalCents : Number.MAX_SAFE_INTEGER;
          return fa - fb;
        });
        
        // Cache dos resultados combinados
        if (allResults.length) cache.set(cacheKey, allResults);
        
        // Paginar resultados combinados
        const start = (pageNum - 1) * pageSize;
        const pageItems = allResults.slice(start, start + pageSize);
        
        return reply.send(pageItems);
      } catch (epicErr) {
        console.error('Erro ao buscar dados da Epic Games:', epicErr);
        // Se ocorrer erro ao buscar da Epic, retornar apenas os resultados da Steam
        if (enriched.length) cache.set(cacheKey, enriched);
        const start = (pageNum - 1) * pageSize;
        const pageItems = enriched.slice(start, start + pageSize);
        return reply.send(pageItems);
      }
    } catch (err) {
      console.error('Erro na rota /search (nova lógica):', err)
      return reply.status(500).send({ error: 'Erro interno do servidor' })
    }
  })
}
