// Serviço para chamadas reais da Steam API - conforme especificações do usuário
export interface SteamPriceResponse {
  source: 'app' | 'package' | 'bundle'
  appId: number
  packageId?: number
  bundleId?: number
  title: string
  priceBaseCents: number
  priceFinalCents: number
  discountPct: number
  currency: string
  priceFinalBRL: string
  url: string
  genres?: string[]
}

export interface SteamFeaturedItem {
  source: 'app' | 'package' | 'bundle'
  appId?: number
  packageId?: number
  bundleId?: number
  title: string
  priceBaseCents: number
  priceFinalCents: number
  discountPct: number
  currency: string
  url: string
  genres?: string[]
}

const USER_AGENT = 'Looton/1.0'

function centsToBRLString(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

async function fetchWithHeaders(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9',
      ...options.headers
    }
  })
}

export async function fetchSteamAppPrice(appId: number): Promise<SteamPriceResponse | null> {
  try {
    // Tentar app primeiro
    const appUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=br&l=portuguese`
    const appResponse = await fetchWithHeaders(appUrl)
    const appData = await appResponse.json()
    
    const gameData = appData[appId]
    if (gameData?.success && gameData?.data?.price_overview) {
      const price = gameData.data.price_overview
      const genres = (gameData.data.genres || []).map((g: any) => g.description || g.description || g.id || g) as string[]
      return {
        source: 'app',
        appId,
        title: gameData.data.name,
        priceBaseCents: price.initial || price.final,
        priceFinalCents: price.final,
        discountPct: price.discount_percent || 0,
        currency: price.currency || 'BRL',
        priceFinalBRL: centsToBRLString(price.final),
        url: `https://store.steampowered.com/app/${appId}/`,
        genres
      }
    }

    // Fallback para packages se existe
    if (gameData?.success && gameData?.data?.packages?.length > 0) {
      const packageId = gameData.data.packages[0]
      const packageUrl = `https://store.steampowered.com/api/packagedetails?packageids=${packageId}&cc=br&l=portuguese`
      const packageResponse = await fetchWithHeaders(packageUrl)
      const packageData = await packageResponse.json()
      
      const pkgData = packageData[packageId]
      if (pkgData?.success && pkgData?.data?.price) {
        const price = pkgData.data.price
        const finalCents = price.final_with_tax || price.final_amount || price.final
        const baseCents = price.initial_with_tax || price.initial_amount || price.individual || finalCents
        
        return {
          source: 'package',
          appId,
          packageId,
          title: pkgData.data.name,
          priceBaseCents: baseCents,
          priceFinalCents: finalCents,
          discountPct: price.discount_percent || 0,
          currency: price.currency || 'BRL',
          priceFinalBRL: centsToBRLString(finalCents),
          url: `https://store.steampowered.com/sub/${packageId}/`
        }
      }
    }

    // Fallback para bundles se existe
    if (gameData?.success && gameData?.data?.bundle?.length > 0) {
      const bundleId = gameData.data.bundle[0]
      const bundleUrl = `https://store.steampowered.com/api/bundledetails?bundleids=${bundleId}&cc=br&l=portuguese`
      const bundleResponse = await fetchWithHeaders(bundleUrl)
      const bundleData = await bundleResponse.json()
      
      const bundData = bundleData[bundleId]
      if (bundData?.success && bundData?.data?.price) {
        const price = bundData.data.price
        const finalCents = price.final_with_tax || price.final_amount || price.final
        const baseCents = price.initial_with_tax || price.initial_amount || price.individual || finalCents
        
        return {
          source: 'bundle',
          appId,
          bundleId,
          title: bundData.data.name,
          priceBaseCents: baseCents,
          priceFinalCents: finalCents,
          discountPct: price.discount_percent || 0,
          currency: price.currency || 'BRL',
          priceFinalBRL: centsToBRLString(finalCents),
          url: `https://store.steampowered.com/bundle/${bundleId}/`
        }
      }
    }

    return null
  } catch (error) {
    console.error('Erro ao buscar preço Steam:', error)
    return null
  }
}

export async function fetchSteamFeatured(): Promise<SteamFeaturedItem[]> {
  try {
    const url = 'https://store.steampowered.com/api/featuredcategories?cc=br&l=portuguese'
    const response = await fetchWithHeaders(url)
    const data = await response.json()
    
    const items: SteamFeaturedItem[] = []
    
    // Processar diferentes categorias de ofertas
    const categories = [
      data.specials?.items || [],
      data.featured_win || [],
      data.top_sellers?.items || [],
      data.new_releases?.items || [],
      data.coming_soon?.items || []
    ]
    
    for (const category of categories) {
      for (const item of category) {
        if (items.length >= 50) break
        
        let priceData = null
        let source: 'app' | 'package' | 'bundle' = 'app'
        let id = item.id
        let url = `https://store.steampowered.com/app/${id}/`
        
        // Tentar diferentes formatos de preço
        if (item.price_overview) {
          priceData = item.price_overview
        } else if (item.final_price !== undefined) {
          priceData = {
            final: item.final_price,
            initial: item.original_price || item.final_price,
            discount_percent: item.discount_percent || 0,
            currency: 'BRL'
          }
        }
        
        // Se for um package
        if (item.type === 'sub' || item.packageid) {
          source = 'package'
          id = item.packageid || item.id
          url = `https://store.steampowered.com/sub/${id}/`
        }
        
        // Se for um bundle
        if (item.type === 'bundle' || item.bundleid) {
          source = 'bundle'
          id = item.bundleid || item.id  
          url = `https://store.steampowered.com/bundle/${id}/`
        }
        
        if (priceData && item.name) {
          const steamItem: SteamFeaturedItem = {
            source,
            title: item.name,
            priceBaseCents: priceData.initial || priceData.final,
            priceFinalCents: priceData.final,
            discountPct: priceData.discount_percent || 0,
            currency: priceData.currency || 'BRL',
            url
            ,
            genres: (item.genres || []).map((g: any) => g.description || g) as string[]
          }
          
          // Adicionar ID correto baseado no source
          if (source === 'app') steamItem.appId = id
          else if (source === 'package') steamItem.packageId = id  
          else if (source === 'bundle') steamItem.bundleId = id

          // Exclude specific DOOM variation that shouldn't appear (some Steam entries/packages)
          // Known problematic identifiers and title:
          // - store app/package/bundle id: 235874
          // - title: 'DOOM Eternal Standard Edition'
          const titleLower = (steamItem.title || '').toLowerCase()
          const isDoomByTitle = titleLower === 'doom eternal standard edition'
          const isDoomById = id === 235874 || item.id === 235874 || item.packageid === 235874 || item.bundleid === 235874

          if (isDoomByTitle || isDoomById) {
            // skip adding this item
          } else {
            items.push(steamItem)
          }
        }
      }
      
      if (items.length >= 50) break
    }
    
    return items.slice(0, 50)
  } catch (error) {
    console.error('Erro ao buscar ofertas Steam:', error)
    return []
  }
}