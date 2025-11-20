// Serviço para chamadas reais da Steam API - conforme especificações do usuário

// Maintain the old interface for backward compatibility but use the new implementation
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
  coverUrl?: string
  genres?: string[]
  tags?: string[]
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
  // Convert integer cents to properly formatted BRL string
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// Keep the original function that fetches real prices from Steam
export async function fetchSteamAppPrice(appId: number): Promise<SteamPriceResponse | null> {
  try {
    // Tentar app primeiro
    const appUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=BR&l=pt-BR`  // Use BR region
    const appResponse = await fetch(appUrl, { 
      headers: { 'User-Agent': 'Looton/1.0' } 
    })
    const appData = await appResponse.json()
    
    const gameData = appData[appId]
    if (gameData?.success && gameData?.data?.price_overview) {
      const price = gameData.data.price_overview
      const genres = (gameData.data.genres || []).map((g: any) => g.description || g.description || g.id || g) as string[]
      const coverUrl = gameData.data.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
      const tags = (gameData.data.categories || []).map((c: any) => c.description || c.name) as string[]
      return {
        source: 'app',
        appId,
        title: gameData.data.name,
        priceBaseCents: (price.initial || price.final) * 100,  // Convert to cents properly
        priceFinalCents: price.final * 100,  // Convert to cents properly
        discountPct: price.discount_percent || 0,
        currency: price.currency || 'BRL',
        priceFinalBRL: centsToBRLString(price.final),
        url: `https://store.steampowered.com/app/${appId}/`,
        coverUrl,
        genres,
        tags
      }
    }

    // Fallback para packages se existe
    if (gameData?.success && gameData?.data?.packages?.length > 0) {
      const packageId = gameData.data.packages[0]
      const packageUrl = `https://store.steampowered.com/api/packagedetails?packageids=${packageId}&cc=BR&l=pt-BR`  // Use BR region
      const packageResponse = await fetch(packageUrl, { 
        headers: { 'User-Agent': 'Looton/1.0' } 
      })
      const packageData = await packageResponse.json()
      
      const pkgData = packageData[packageId]
      if (pkgData?.success && pkgData?.data?.price) {
        const price = pkgData.data.price
        const finalValue = price.final_with_tax || price.final_amount || price.final
        const baseValue = price.initial_with_tax || price.initial_amount || price.individual || finalValue
        
        const coverUrl = pkgData.data.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
        const tags = (pkgData.data.categories || []).map((c: any) => c.description || c.name) as string[]
        return {
          source: 'package',
          appId,
          packageId,
          title: pkgData.data.name,
          priceBaseCents: baseValue * 100,  // Convert to cents properly
          priceFinalCents: finalValue * 100,  // Convert to cents properly
          discountPct: price.discount_percent || 0,
          currency: price.currency || 'BRL',
          priceFinalBRL: centsToBRLString(finalValue),
          url: `https://store.steampowered.com/sub/${packageId}/`,
          coverUrl,
          tags
        }
      }
    }

    // Fallback para bundles se existe
    if (gameData?.success && gameData?.data?.bundle?.length > 0) {
      const bundleId = gameData.data.bundle[0]
      const bundleUrl = `https://store.steampowered.com/api/bundledetails?bundleids=${bundleId}&cc=BR&l=pt-BR`  // Use BR region
      const bundleResponse = await fetch(bundleUrl, { 
        headers: { 'User-Agent': 'Looton/1.0' } 
      })
      const bundleData = await bundleResponse.json()
      
      const bundData = bundleData[bundleId]
      if (bundData?.success && bundData?.data?.price) {
        const price = bundData.data.price
        const finalValue = price.final_with_tax || price.final_amount || price.final
        const baseValue = price.initial_with_tax || price.initial_amount || price.individual || finalValue
        
        const coverUrl = bundData.data.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
        const tags = (bundData.data.categories || []).map((c: any) => c.description || c.name) as string[]
        return {
          source: 'bundle',
          appId,
          bundleId,
          title: bundData.data.name,
          priceBaseCents: baseValue * 100,  // Convert to cents properly
          priceFinalCents: finalValue * 100,  // Convert to cents properly
          discountPct: price.discount_percent || 0,
          currency: price.currency || 'BRL',
          priceFinalBRL: centsToBRLString(finalValue),
          url: `https://store.steampowered.com/bundle/${bundleId}/`,
          coverUrl,
          tags
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
    const url = 'https://store.steampowered.com/api/featuredcategories?cc=BR&l=pt-BR'
    const response = await fetch(url, { headers: { 'User-Agent': 'Looton/1.0' } })
    const data = await response.json()
    
    const items: SteamFeaturedItem[] = []
    
    // Processar apenas ofertas especiais (specials)
    const categories = [
      data.specials?.items || []
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
            priceBaseCents: (priceData.initial || priceData.final) * 100, // Convert to cents
            priceFinalCents: priceData.final * 100, // Convert to cents
            discountPct: priceData.discount_percent || 0,
            currency: priceData.currency || 'BRL',
            url,
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
          
          // Exclude Assassin's Creed Black Flag - Golden Edition which doesn't exist on Steam
          const isAssassinBlackFlagGolden = titleLower.includes('assassin\'s creed black flag') && titleLower.includes('golden edition')

          if (isDoomByTitle || isDoomById || isAssassinBlackFlagGolden) {
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