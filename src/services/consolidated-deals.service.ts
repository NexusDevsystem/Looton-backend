import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'
import { shuffleWithSeed, stringToSeed } from '../utils/seedable-prng.js'
import { listFreeGames } from '../integrations/epic/freeGames.js'
import { filterInappropriateGames } from '../utils/content-filter.js'

export interface ConsolidatedDeal {
  id: string // app:123 | package:456 | bundle:789
  title: string
  slug: string
  coverUrl?: string
  genres?: string[]
  tags?: string[]
  kind: 'game' | 'dlc' | 'package' | 'bundle'
  isFree?: boolean
  baseGameTitle?: string
  currency?: string
  releaseDate?: string // Data de lançamento no formato ISO
  stores: Array<{
    store: 'steam' | 'epic'
    storeAppId: string // somente o número
    url: string
    priceBase?: number
    priceFinal?: number
    discountPct?: number
    isActive: boolean
  }>
  bestPrice: {
    store: string
    price?: number
    discountPct?: number
  }
  totalStores: number
}

// Cache normalizado por cc/l (5 minutos)
const normalizedCache = new MemoryCache<string, ConsolidatedDeal[]>(ttlSecondsToMs(300))

function cacheKey(cc: string, l: string) {
  return `${cc}|${l}`.toLowerCase()
}

async function fetchSpecials(cc: string, l: string) {
  const url = `https://store.steampowered.com/api/featuredcategories?cc=${cc}&l=${l}`
  const res = await fetch(url)
  if (!res.ok) return [] as any[]
  const json = await res.json()
  const items: any[] = json?.specials?.items ?? []
  return items
}

// Nova função: Buscar top sellers da Steam
async function fetchTopSellers(cc: string, l: string) {
  try {
    const url = `https://store.steampowered.com/api/featuredcategories?cc=${cc}&l=${l}`
    const res = await fetch(url)
    if (!res.ok) return [] as any[]
    const json = await res.json()
    const topSellers: any[] = json?.top_sellers?.items ?? []
    const newReleases: any[] = json?.new_releases?.items ?? []
    // Combinar top sellers e lançamentos
    return [...topSellers, ...newReleases]
  } catch (error) {
    console.error('Erro ao buscar top sellers:', error)
    return []
  }
}

// Nova função: Buscar jogos por tag/gênero
async function fetchByTag(tag: string, cc: string, l: string, maxResults: number = 50) {
  try {
    // Usar a API de busca da Steam com filtro de tag
    // Nota: Esta é uma implementação simplificada. A Steam não tem uma API pública oficial para isso
    // mas podemos buscar na página de tags
    const tagMap: Record<string, number> = {
      'racing': 699,      // Racing tag ID
      'action': 19,       // Action tag ID
      'adventure': 21,    // Adventure tag ID
      'rpg': 122,         // RPG tag ID
      'strategy': 9,      // Strategy tag ID
      'sports': 701,      // Sports tag ID
      'indie': 492,       // Indie tag ID
      'simulation': 599,  // Simulation tag ID
    }
    
    const tagId = tagMap[tag.toLowerCase()]
    if (!tagId) return []
    
    // Buscar jogos com essa tag usando a API de featured que suporta tags
    const url = `https://store.steampowered.com/contenthub/querypaginated/specials/TopSellers/render/?query=&start=0&count=${maxResults}&cc=${cc}&l=${l}&v=4&tag=${tagId}`
    const res = await fetch(url)
    if (!res.ok) return []
    
    const json = await res.json()
    const items = json?.results_html ? [] : [] // A API retorna HTML, precisaríamos parsear
    
    // Fallback: retornar vazio se não conseguir parsear
    return []
  } catch (error) {
    console.error(`Erro ao buscar jogos por tag ${tag}:`, error)
    return []
  }
}

function centsToUnit(n?: number) { return typeof n === 'number' ? Math.round(n) / 100 : undefined }
function clampPct(n?: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return undefined
  return Math.max(0, Math.min(100, Math.round(n)))
}

type Normalized = {
  kind: 'game'|'dlc'|'package'|'bundle'
  id: string
  title: string
  coverUrl?: string
  url: string
  priceOriginalCents?: number
  priceFinalCents?: number
  discountPct?: number
  currency?: string
  isFree?: boolean
  baseGameTitle?: string
  tags?: string[]
}

async function resolveApp(appid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/appdetails/?appids=${appid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(appid)]
  if (!node?.success) return undefined
  const d = node.data
  const type = (d?.type as string) || 'game'
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/app/${appid}/`
  const releaseDate = d?.release_date?.date as string | undefined // Data de lançamento
  
  // Extract genres and categories from Steam API
  const genres = (d?.genres || []).map((g: any) => g?.description || '').filter(Boolean)
  const categories = (d?.categories || []).map((c: any) => c?.description || '').filter(Boolean)
  const allTags = [...new Set([...genres, ...categories])]

  if (type === 'game') {
    if (d?.is_free || !d?.price_overview) {
      return { kind: 'game', id: `app:${appid}`, title, coverUrl: header, url, isFree: true, tags: allTags }
    }
    const pov = d.price_overview
    const currency = pov?.currency as string | undefined
    return {
      kind: 'game',
      id: `app:${appid}`,
      title,
      coverUrl: header,
      url,
      priceOriginalCents: pov?.initial,
      priceFinalCents: pov?.final,
      discountPct: pov?.discount_percent,
      currency,
      tags: allTags
    }
  }

  if (type === 'dlc') {
    const pov = d?.price_overview
    const currency = pov?.currency as string | undefined
    const baseGameTitle = d?.fullgame?.name as string | undefined
    return {
      kind: 'dlc',
      id: `app:${appid}`,
      title,
      coverUrl: header,
      url,
      priceOriginalCents: pov?.initial,
      priceFinalCents: pov?.final,
      discountPct: pov?.discount_percent,
      currency,
      baseGameTitle,
      tags: allTags
    }
  }

  // Outros tipos tratados como app comum
  const pov = d?.price_overview
  const currency = pov?.currency as string | undefined
  return {
    kind: 'game',
    id: `app:${appid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: pov?.initial,
    priceFinalCents: pov?.final,
    discountPct: pov?.discount_percent,
    currency,
    tags: allTags
  }
}

async function resolvePackage(packageid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/packagedetails/?packageids=${packageid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(packageid)]
  if (!node?.success) return undefined
  const d = node.data
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/sub/${packageid}/`
  const price = d?.price
  return {
    kind: 'package',
    id: `package:${packageid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: price?.initial,
    priceFinalCents: price?.final,
    discountPct: price?.discount_percent,
    currency: price?.currency
  }
}

async function resolveBundle(bundleid: number, cc: string, l: string): Promise<Normalized | undefined> {
  const resp = await fetch(`https://store.steampowered.com/api/bundledetails/?bundleids=${bundleid}&cc=${cc}&l=${l}`)
  if (!resp.ok) return undefined
  const data = await resp.json() as any
  const node = data[String(bundleid)]
  if (!node?.success) return undefined
  const d = node.data
  const title = d?.name as string
  const header = d?.header_image as string | undefined
  const url = `https://store.steampowered.com/bundle/${bundleid}/`
  const price = d?.price
  return {
    kind: 'bundle',
    id: `bundle:${bundleid}`,
    title,
    coverUrl: header,
    url,
    priceOriginalCents: price?.initial,
    priceFinalCents: price?.final,
    discountPct: price?.discount_percent,
    currency: price?.currency
  }
}

// Cache para pools diários por região
const dailyPoolsCache = new MemoryCache<string, ConsolidatedDeal[]>(ttlSecondsToMs(7200)) // 2h TTL

// Cache para listas de ofertas diárias
const dailyFeaturedCache = new MemoryCache<string, ConsolidatedDeal[]>(ttlSecondsToMs(108000)) // 30h TTL

// Cache para IDs recentes (antirrepetição de 7 dias)
const recentIdsCache = new MemoryCache<string, Set<string>>(ttlSecondsToMs(604800)) // 7 dias TTL

export async function fetchConsolidatedDeals(limit: number = 50, opts?: { cc?: string; l?: string; useDailyRotation?: boolean }): Promise<ConsolidatedDeal[]> {
  const cc = (opts?.cc || 'BR').toUpperCase()
  const l = opts?.l || 'pt-BR'
  const useDailyRotation = opts?.useDailyRotation ?? false  // Mudança: false em vez de true para exibir ofertas reais consistentemente
  const ckey = cacheKey(cc, l)

  // Se for para rotação diária, usar o sistema de rotação
  if (useDailyRotation) {
    const dayKey = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD no fuso local
    const cacheKeyFeatured = `featured:${cc}:${l}:${dayKey}`
    
    // Tentar obter do cache
    const cachedFeatured = dailyFeaturedCache.get(cacheKeyFeatured)
    if (cachedFeatured) {
      console.log(`✅ Ofertas diárias recuperadas do cache para ${cc}:${l}:${dayKey} (${cachedFeatured.length} itens)`)
      return cachedFeatured.slice(0, limit)
    }

    // Gerar novas ofertas para o dia
    const dailyDeals = await generateDailyFeatured(cc, l, dayKey, limit)
    dailyFeaturedCache.set(cacheKeyFeatured, dailyDeals)
    
    console.log(`✅ Novas ofertas diárias geradas para ${cc}:${l}:${dayKey} (${dailyDeals.length} itens)`)
    return dailyDeals.slice(0, limit)
  }

  // Caso contrário, buscar de múltiplas fontes para ter um catálogo maior
  const cached = normalizedCache.get(ckey)
  if (cached) {
    console.log(`✅ Usando ${cached.length} deals do cache`)
    return cached.slice(0, limit)
  }

  try {
    console.log(`🔍 Buscando deals de múltiplas fontes para ${cc}/${l}...`)
    
    // 1. Buscar specials (jogos em promoção especial)
    const specials = await fetchSpecials(cc, l)
    console.log(`📦 Specials: ${specials.length} itens`)
    
    // 2. Buscar top sellers e novos lançamentos
    const topSellers = await fetchTopSellers(cc, l)
    console.log(`🏆 Top Sellers + New Releases: ${topSellers.length} itens`)
    
    // 3. Obter jogos grátis da Epic Games
    let epicFreeGames: any[] = [];
    try {
      const epicDeals = await listFreeGames(l, cc, cc);
      epicFreeGames = epicDeals.map(deal => ({
        ...deal,
        store: 'epic'
      }));
      console.log(`🎮 Epic Free Games: ${epicFreeGames.length} itens`)
    } catch (epicError) {
      console.warn('Falha ao buscar ofertas da Epic Games:', epicError);
    }
    
    // Combinar todas as fontes e remover duplicatas
    const allItems = [...specials, ...topSellers]
    const uniqueItems = new Map<number, any>()
    
    for (const item of allItems) {
      if (item?.id && !uniqueItems.has(item.id)) {
        uniqueItems.set(item.id, item)
      }
    }
    
    const combinedSpecials = Array.from(uniqueItems.values())
    console.log(`✨ Total único após combinar fontes: ${combinedSpecials.length} itens`)
    
    // Ordena por desconto desc para priorizar os melhores
    combinedSpecials.sort((a: any, b: any) => (b?.discount_percent || 0) - (a?.discount_percent || 0))

    // Converter os itens diretos de specials para ConsolidatedDeal
    // Estes itens já contêm dados de preço e desconto completos
    const consolidated: ConsolidatedDeal[] = []
    

    
    // Processar ofertas da Steam
    for (const item of combinedSpecials) {
      // Verificar campos obrigatórios
      if (!item?.id || !item?.name) continue
      
      // Converter preços de centavos para reais
      const originalPrice = (item.original_price ?? 0) / 100
      const finalPrice = (item.final_price ?? 0) / 100
      const discountPercent = item.discount_percent ?? 0
      
      // Só adicionar se tiver desconto ou for gratuito
      if (!(discountPercent > 0 || item.is_free)) continue
      
      const slug = item.name.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, '')
      
      consolidated.push({
        id: `app:${item.id}`,
        title: item.name,
        slug,
        coverUrl: item.header_image || item.small_capsule_image,
        genres: [],
        tags: [],
        kind: 'game',
        isFree: !!item.is_free,
        baseGameTitle: undefined,
        currency: item.currency || 'BRL',
        releaseDate: item.release_date || undefined, // Adicionando a data de lançamento, se disponível
        stores: [{
          store: 'steam',
          storeAppId: String(item.id),
          url: `https://store.steampowered.com/app/${item.id}/`,
          priceBase: item.is_free ? 0 : originalPrice,
          priceFinal: item.is_free ? 0 : finalPrice,
          discountPct: item.is_free ? 0 : discountPercent,
          isActive: true
        }],
        bestPrice: {
          store: 'steam',
          price: item.is_free ? 0 : finalPrice,
          discountPct: item.is_free ? 0 : discountPercent
        },
        totalStores: 1
      })
    }
    
    // Processar ofertas da Epic Games
    for (const epicDeal of epicFreeGames) {
      // Verificar campos obrigatórios
      if (!epicDeal?.title) continue
      
      const slug = epicDeal.title.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, '')
      
      // Verificar se já temos um jogo com o mesmo título para evitar duplicidade
      const existingDeal = consolidated.find(deal => 
        deal.title.toLowerCase() === epicDeal.title.toLowerCase()
      );
      
      if (existingDeal) {
        // Se já existe, adicionar a loja Epic ao array de lojas existente
        const existingStore = existingDeal.stores.find(store => store.store === 'epic');
        if (!existingStore) {
          existingDeal.stores.push({
            store: 'epic',
            storeAppId: epicDeal.stores?.[0]?.storeAppId || epicDeal.id || 'unknown',
            url: epicDeal.stores?.[0]?.url || epicDeal.url,
            priceBase: epicDeal.stores?.[0]?.priceBase || epicDeal.priceBase,
            priceFinal: epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal,
            discountPct: epicDeal.stores?.[0]?.discountPct || epicDeal.discountPct,
            isActive: true
          });
          existingDeal.totalStores += 1;
          
          // Atualizar o melhor preço se necessário
          if (!existingDeal.bestPrice.price || (epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal) < (existingDeal.bestPrice.price || Infinity)) {
            existingDeal.bestPrice = {
              store: 'epic',
              price: epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal,
              discountPct: epicDeal.stores?.[0]?.discountPct || epicDeal.discountPct
            }
          }
        }
      } else {
        // Se não existe, adicionar como novo deal
        consolidated.push({
          id: epicDeal.id,
          title: epicDeal.title,
          slug,
          coverUrl: epicDeal.coverUrl,
          genres: epicDeal.genres || [],
          tags: epicDeal.tags || [],
          kind: epicDeal.kind || 'game',
          isFree: epicDeal.isFree,
          baseGameTitle: undefined,
          currency: epicDeal.currency,
          releaseDate: epicDeal.releaseDate, // Adicionando a data de lançamento
          stores: epicDeal.stores,
          bestPrice: epicDeal.bestPrice,
          totalStores: epicDeal.totalStores
        })
      }
    }

    console.log(`📦 Total consolidado ANTES do filtro: ${consolidated.length} itens`)
    
    // 🛡️ FILTRAR CONTEÚDO IMPRÓPRIO
    const safeConsolidated = filterInappropriateGames(consolidated)
    console.log(`🛡️ Total consolidado APÓS filtro: ${safeConsolidated.length} itens (${consolidated.length - safeConsolidated.length} removidos)`)

    if (safeConsolidated.length > 0) {
      normalizedCache.set(ckey, safeConsolidated)
      console.log(`💾 Salvando ${safeConsolidated.length} deals consolidados no cache`)
    }

    console.log(`✅ Retornando ${Math.min(safeConsolidated.length, limit)} deals (de ${safeConsolidated.length} disponíveis)`)
    return safeConsolidated.slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar deals consolidadas:', error)
    return []
  }
}

// Função para gerar as ofertas diárias com rotação
async function generateDailyFeatured(cc: string, l: string, dayKey: string, limit: number = 50): Promise<ConsolidatedDeal[]> {
  // Gerar seed baseada em cc + l + dayKey
  const seedInput = `${cc}|${l}|${dayKey}`;
  const seed = stringToSeed(seedInput);
  
  // Obter ou criar pool diário
  const poolKey = `pool:${cc}:${l}`;
  let pool = dailyPoolsCache.get(poolKey);
  
  if (!pool) {
    // Atualizar pool com ofertas elegíveis
    pool = await generateEligiblePool(cc, l);
    dailyPoolsCache.set(poolKey, pool);
  }
  
  // Obter IDs recentes para antirrepetição (7 dias para evitar repetição real)
  const recentKey = `recent:${cc}:${l}`;
  let recentIds = recentIdsCache.get(recentKey);
  if (!recentIds) {
    recentIds = new Set<string>();
    recentIdsCache.set(recentKey, recentIds);
  }
  
  // Filtrar pool para excluir IDs recentes
  const poolWithoutRecent = pool.filter(deal => !recentIds!.has(deal.id));
  
  // Se não houver itens suficientes após filtragem, usar o pool completo
  // (mas somente para esta requisição, não adicionar ao recentIds global)
  let selected: ConsolidatedDeal[];
  if (poolWithoutRecent.length === 0) {
    // Se todos os itens estão nos recentIds, usar o pool original
    // mas ainda embaralhar com a seed para consistência diária
    const shuffledPool = shuffleWithSeed(pool, seed);
    selected = shuffledPool.slice(0, limit);
  } else {
    // Se temos itens após filtragem, verificar se temos quantidade suficiente para o limite
    // Se não tivermos, mesclar itens recentes e não recentes
    let finalPool: ConsolidatedDeal[];
    if (poolWithoutRecent.length < limit) {
      // Combina itens não recentes + alguns itens recentes para atingir o limite
      const shuffledRecent = shuffleWithSeed(
        pool.filter(deal => recentIds!.has(deal.id)), 
        seed + 1 // usar seed diferente para evitar repetição exata
      );
      finalPool = [...poolWithoutRecent, ...shuffledRecent.slice(0, limit - poolWithoutRecent.length)];
    } else {
      finalPool = poolWithoutRecent;
    }
    
    const shuffledPool = shuffleWithSeed(finalPool, seed);
    selected = shuffledPool.slice(0, limit);
  }
  
  // Adicionar os selecionados aos IDs recentes (apenas se não estiver vazio para evitar problemas)
  // Mas não adicionar se usamos itens recentes (para não duplicar a marcação)
  if (selected.length > 0 && poolWithoutRecent.length > 0) {
    for (const deal of selected) {
      if (!recentIds.has(deal.id)) { // Só adicionar se não estiver nos recentes
        recentIds.add(deal.id);
      }
    }
  }
  
  return selected;
}

// Função para gerar o pool elegível de ofertas
async function generateEligiblePool(cc: string, l: string): Promise<ConsolidatedDeal[]> {
  const specials = await fetchSpecials(cc, l)
  // Obter também os jogos grátis da Epic Games
  let epicFreeGames: any[] = [];
  try {
    const epicDeals = await listFreeGames(l, cc, cc);
    epicFreeGames = epicDeals.map(deal => ({
      ...deal,
      store: 'epic' // Marcar como proveniente da Epic
    }));
  } catch (epicError) {
    console.warn('Falha ao buscar ofertas da Epic Games no pool elegível:', epicError);
    // Continuar sem dados da Epic se a API falhar
  }
  
  // Ordena por desconto desc para priorizar os melhores
  specials.sort((a: any, b: any) => (b?.discount_percent || 0) - (a?.discount_percent || 0))

  // Converter os itens diretos de specials para ConsolidatedDeal
  const consolidated: ConsolidatedDeal[] = []
  
  // Processar ofertas da Steam
  for (const item of specials) {
    // Verificar campos obrigatórios
    if (!item?.id || !item?.name) continue
    
    // Converter preços de centavos para reais
    const originalPrice = (item.original_price ?? 0) / 100
    const finalPrice = (item.final_price ?? 0) / 100
    const discountPercent = item.discount_percent ?? 0
    
    // Aplicar filtro de desconto mínimo (30% como especificado)
    if (discountPercent < 30) continue
    
    const slug = item.name.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, '')
    
    consolidated.push({
      id: `app:${item.id}`,
      title: item.name,
      slug,
      coverUrl: item.header_image || item.small_capsule_image,
      genres: [],
      tags: [],
      kind: 'game',
      isFree: !!item.is_free,
      baseGameTitle: undefined,
      currency: item.currency || 'BRL',
      releaseDate: item.release_date, // Adicionando a data de lançamento
      stores: [{
        store: 'steam',
        storeAppId: String(item.id),
        url: `https://store.steampowered.com/app/${item.id}/`,
        priceBase: item.is_free ? 0 : originalPrice,
        priceFinal: item.is_free ? 0 : finalPrice,
        discountPct: item.is_free ? 0 : discountPercent,
        isActive: true
      }],
      bestPrice: {
        store: 'steam',
        price: item.is_free ? 0 : finalPrice,
        discountPct: item.is_free ? 0 : discountPercent
      },
      totalStores: 1
    })
  }
  
  // Processar ofertas da Epic Games (jogos grátis, que têm 100% de desconto)
  for (const epicDeal of epicFreeGames) {
    // Verificar campos obrigatórios
    if (!epicDeal?.title) continue
    
    const slug = epicDeal.title.toLowerCase().replace(/[^\\w]+/g, '-').replace(/(^-|-$)/g, '')
    
    // Verificar se já temos um jogo com o mesmo título para evitar duplicidade
    const existingDeal = consolidated.find(deal => 
      deal.title.toLowerCase() === epicDeal.title.toLowerCase()
    );
    
    if (existingDeal) {
      // Se já existe, adicionar a loja Epic ao array de lojas existente
      const existingStore = existingDeal.stores.find(store => store.store === 'epic');
      if (!existingStore) {
        existingDeal.stores.push({
          store: 'epic',
          storeAppId: epicDeal.stores?.[0]?.storeAppId || epicDeal.id || 'unknown',
          url: epicDeal.stores?.[0]?.url || epicDeal.url,
          priceBase: epicDeal.stores?.[0]?.priceBase || epicDeal.priceBase,
          priceFinal: epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal,
          discountPct: epicDeal.stores?.[0]?.discountPct || epicDeal.discountPct,
          isActive: true
        });
        existingDeal.totalStores += 1;
        
        // Atualizar o melhor preço se necessário
        if (!existingDeal.bestPrice.price || (epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal) < (existingDeal.bestPrice.price || Infinity)) {
          existingDeal.bestPrice = {
            store: 'epic',
            price: epicDeal.stores?.[0]?.priceFinal || epicDeal.priceFinal,
            discountPct: epicDeal.stores?.[0]?.discountPct || epicDeal.discountPct
          }
        }
      }
    } else {
      // Se não existe, adicionar como novo deal
      // Incluir apenas se for um jogo grátis (100% de desconto)
      if (epicDeal.isFree || epicDeal.discountPct === 100) {
        consolidated.push({
          id: epicDeal.id,
          title: epicDeal.title,
          slug,
          coverUrl: epicDeal.coverUrl,
          genres: epicDeal.genres || [],
          tags: epicDeal.tags || [],
          kind: epicDeal.kind || 'game',
          isFree: epicDeal.isFree,
          baseGameTitle: undefined,
          currency: epicDeal.currency,
          releaseDate: epicDeal.releaseDate, // Adicionando a data de lançamento
          stores: epicDeal.stores,
          bestPrice: epicDeal.bestPrice,
          totalStores: epicDeal.totalStores
        })
      }
    }
  }

  console.log(`📦 Pool ANTES do filtro: ${consolidated.length} itens`)
  
  // 🛡️ FILTRAR CONTEÚDO IMPRÓPRIO
  const safeConsolidated = filterInappropriateGames(consolidated)
  console.log(`🛡️ Pool APÓS filtro: ${safeConsolidated.length} itens (${consolidated.length - safeConsolidated.length} removidos)`)
  console.log(`🎮 Pool de ofertas elegíveis gerado para ${cc}:${l} (${safeConsolidated.length} itens)`)

  return safeConsolidated;
}