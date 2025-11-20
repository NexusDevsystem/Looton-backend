import { MemoryCache, ttlSecondsToMs } from '../cache/memory.js'
import { shuffleWithSeed, stringToSeed } from '../utils/seedable-prng.js'
import { listFreeGames } from '../integrations/epic/freeGames.js'
import { filterNSFWGamesAsync } from '../utils/nsfw-shield.js'
import { filterGamesWithAI } from './content-ai-classifier.service.js'
import { steamAdapter } from '../adapters/steam.adapter.js'
import { epicAdapter } from '../adapters/epic.adapter.js'
// import { itadAdapter } from '../adapters/itad.adapter.js' // REMOVIDO - Não usar ITAD

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
    store: 'steam' | 'epic' | 'ubisoft'
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

// Palavras-chave EXATAS para identificar DLCs, pacotes e conteúdos adicionais
// IMPORTANTE: Usar apenas termos muito específicos para evitar falsos positivos
const DLC_EXACT_KEYWORDS = [
  'soundtrack', 'ost', 'season pass', 'expansion pass', 'expansion pack',
  'character pack', 'weapon pack', 'skin pack', 'map pack', 'booster pack',
  'artbook', 'art book', 'wallpaper pack', 'deluxe upgrade', 'gold upgrade',
  'premium upgrade', 'ultimate upgrade', 'digital deluxe upgrade'
]

// Padrões que indicam DLC quando combinados com " - " no título
const DLC_SUFFIX_PATTERNS = [
  'dlc', 'expansion', 'soundtrack', 'ost', 'season pass', 'add-on', 'addon'
]

// Função para verificar se um deal é DLC/pacote/conteúdo adicional
function isDLCOrPackage(deal: ConsolidatedDeal | any): boolean {
  // 1. Verificar pelo campo kind (mais confiável)
  if (deal.kind && deal.kind !== 'game') {
    return true
  }

  // 2. Verificar pelo título
  const title = (deal.title || deal.game?.title || '').toLowerCase()

  // 2a. Verificar palavras-chave exatas
  for (const keyword of DLC_EXACT_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(title)) {
      return true
    }
  }

  // 2b. Verificar padrão "Game Name - DLC/Expansion/etc"
  // Só filtrar se tiver " - " E uma das palavras-chave de DLC
  if (title.includes(' - ')) {
    for (const pattern of DLC_SUFFIX_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i')
      if (regex.test(title)) {
        return true
      }
    }
  }

  return false
}

// Função para filtrar DLCs e pacotes de uma lista de deals
function filterOutDLCsAndPackages(deals: ConsolidatedDeal[]): ConsolidatedDeal[] {
  const filtered = deals.filter(deal => !isDLCOrPackage(deal))
  const removed = deals.length - filtered.length
  if (removed > 0) {
    console.log(`🎮 Filtro DLC/Pacote: ${removed} itens removidos de ${deals.length}`)
  }
  return filtered
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
    console.log(`🔍 Buscando deals: Steam (API) + Epic (GraphQL) para ${cc}/${l}...`)
    
    // 1. Buscar deals da STEAM usando API Steam direta
    const steamDeals = await steamAdapter.fetchTrending()
    console.log(`📦 Steam Deals: ${steamDeals.length} itens`)

    if (steamDeals.length === 0) {
      console.warn(`⚠️ ATENÇÃO: Steam retornou 0 deals! Possível rate limit ou erro na API.`)
      console.warn(`💡 Continuando apenas com Epic Games...`)
    }
    
    // 2. Buscar jogos da Epic Games via GraphQL
    let epicFreeGames: any[] = [];
    try {
      const epicDeals = await listFreeGames(l, cc, cc);
      epicFreeGames = epicDeals.map(deal => ({
        ...deal,
        store: 'epic'
      }));
      console.log(`🎮 Epic Games (GraphQL): ${epicFreeGames.length} itens`)
    } catch (epicError) {
      console.warn('⚠️ Falha ao buscar ofertas da Epic Games:', epicError);
    }
    
    console.log(`✨ Total: ${steamDeals.length} Steam + ${epicFreeGames.length} Epic`)

    // Converter deals para ConsolidatedDeal
    const consolidated: ConsolidatedDeal[] = []
    
    // Processar ofertas da STEAM (API direta)
    for (const deal of steamDeals) {
      const slug = deal.title.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '')
      
      consolidated.push({
        id: `steam:${deal.storeAppId}`,
        title: deal.title,
        slug,
        coverUrl: deal.coverUrl || '',
        genres: deal.genres || [],
        tags: deal.tags || [],
        kind: 'game',
        isFree: deal.priceFinal === 0,
        baseGameTitle: undefined,
        currency: deal.currency || 'BRL',
        releaseDate: undefined,
        stores: [{
          store: 'steam',
          storeAppId: deal.storeAppId,
          url: deal.url,
          priceBase: deal.priceBase,
          priceFinal: deal.priceFinal,
          discountPct: deal.discountPct || 0,
          isActive: true
        }],
        bestPrice: {
          store: 'steam',
          price: deal.priceFinal,
          discountPct: deal.discountPct || 0
        },
        totalStores: 1
      })
    }
    
    // Processar ofertas da Epic Games (GraphQL)
    for (const epicDeal of epicFreeGames) {
      // Verificar campos obrigatórios
      if (!epicDeal?.title) continue
      
      const slug = epicDeal.title.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '')
      
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
          releaseDate: epicDeal.releaseDate,
          stores: epicDeal.stores,
          bestPrice: epicDeal.bestPrice,
          totalStores: epicDeal.totalStores
        })
      }
    }
    
    console.log(`📦 Total consolidado ANTES do filtro: ${consolidated.length} itens`)
    
    // 🛡️ NSFW Shield - Sistema multi-camadas (ASYNC - busca idade da Steam)
    const nsfwFiltered = await filterNSFWGamesAsync(consolidated)
    console.log(`🛡️ NSFW filtrado: ${nsfwFiltered.length} itens (${consolidated.length - nsfwFiltered.length} removidos)`)

    // 🤖 AI Content Classifier - Análise profunda de conteúdo adulto
    const safeConsolidated = filterGamesWithAI(nsfwFiltered)
    console.log(`🤖 AI filtrado: ${safeConsolidated.length} itens (${nsfwFiltered.length - safeConsolidated.length} removidos)`)

    // 🎮 Filtro de DLCs/Pacotes - Mostrar apenas jogos base
    const gamesOnly = filterOutDLCsAndPackages(safeConsolidated)
    console.log(`🎮 Filtro DLC: ${gamesOnly.length} jogos base (${safeConsolidated.length - gamesOnly.length} DLCs/pacotes removidos)`)

    if (gamesOnly.length > 0) {
      normalizedCache.set(ckey, gamesOnly)
      console.log(`💾 Salvando ${gamesOnly.length} deals consolidados no cache`)
    }

    console.log(`✅ Retornando ${Math.min(gamesOnly.length, limit)} deals (de ${gamesOnly.length} disponíveis)`)
    return gamesOnly.slice(0, limit)
  } catch (error) {
    console.error('Erro ao buscar deals consolidadas:', error)
    return []
  }
}

// Função para gerar as ofertas diárias com rotação por subconjuntos
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

  if (pool.length === 0) {
    console.log(`⚠️ Pool vazio para ${cc}:${l}`)
    return [];
  }

  // NOVA LÓGICA: Rotação por subconjuntos em vez de apenas shuffle
  // Isso garante que a cada dia os jogos exibidos sejam DIFERENTES, não apenas embaralhados

  // 1. Ordenar o pool de forma determinística para garantir consistência
  // Ordenar por desconto (maior primeiro), depois por título para desempate
  const sortedPool = [...pool].sort((a, b) => {
    const discountA = a.bestPrice.discountPct || 0;
    const discountB = b.bestPrice.discountPct || 0;
    if (discountB !== discountA) return discountB - discountA;
    return (a.title || '').localeCompare(b.title || '');
  });

  // 2. Calcular quantas "janelas" de jogos podemos ter
  // Cada janela contém 'limit' jogos diferentes
  const totalGames = sortedPool.length;
  const windowSize = limit;
  const numWindows = Math.ceil(totalGames / windowSize);

  // 3. Calcular qual janela usar baseado na data
  // Usar a seed para determinar o índice da janela
  const windowIndex = seed % numWindows;

  // 4. Selecionar os jogos da janela atual
  const startIndex = windowIndex * windowSize;
  const endIndex = Math.min(startIndex + windowSize, totalGames);
  let selectedGames = sortedPool.slice(startIndex, endIndex);

  // 5. Se a janela não tiver jogos suficientes, completar com jogos de outras janelas
  if (selectedGames.length < limit) {
    // Pegar jogos adicionais do início da lista (circular)
    const needed = limit - selectedGames.length;
    const additionalGames = sortedPool.slice(0, needed);
    selectedGames = [...selectedGames, ...additionalGames];
  }

  // 6. Embaralhar levemente os jogos selecionados para variar a ordem dentro da janela
  // Mas mantendo os melhores descontos no topo
  const topDeals = selectedGames.slice(0, Math.min(5, selectedGames.length)); // Top 5 mantém posição
  const restDeals = selectedGames.slice(5);
  const shuffledRest = shuffleWithSeed(restDeals, seed);

  const finalSelection = [...topDeals, ...shuffledRest];

  console.log(`📅 Rotação diária: Janela ${windowIndex + 1}/${numWindows} (jogos ${startIndex + 1}-${endIndex} de ${totalGames})`)
  console.log(`✅ Selecionados ${finalSelection.length} jogos diferentes para ${dayKey}`)

  return finalSelection;
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
    // Removido filtro de 30% - mostrar todas as promoções
    // if (discountPercent < 30) continue
    
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
  
  // 🛡️ NSFW Shield - Sistema multi-camadas (ASYNC - busca idade da Steam)
  const nsfwFiltered = await filterNSFWGamesAsync(consolidated)
  console.log(`🛡️ Pool NSFW filtrado: ${nsfwFiltered.length} itens (${consolidated.length - nsfwFiltered.length} removidos)`)

  // 🤖 AI Content Classifier - Análise profunda de conteúdo adulto
  const safeConsolidated = filterGamesWithAI(nsfwFiltered)
  console.log(`🤖 Pool AI filtrado: ${safeConsolidated.length} itens (${nsfwFiltered.length - safeConsolidated.length} removidos)`)

  // 🎮 Filtro de DLCs/Pacotes - Mostrar apenas jogos base
  const gamesOnly = filterOutDLCsAndPackages(safeConsolidated)
  console.log(`🎮 Pool Filtro DLC: ${gamesOnly.length} jogos base (${safeConsolidated.length - gamesOnly.length} DLCs/pacotes removidos)`)
  console.log(`🎮 Pool de ofertas elegíveis gerado para ${cc}:${l} (${gamesOnly.length} itens)`)

  return gamesOnly;
}