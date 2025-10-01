import { OfferDTO, StoreAdapter } from './types.js'
import { env } from '../env.js'
import { fetchSteamAppPrice } from '../services/steam-api.service.js'

const mockOffers: OfferDTO[] = [
  {
    store: 'steam',
    storeAppId: '292030',
    title: 'The Witcher 3: Wild Hunt',
    url: 'https://store.steampowered.com/app/292030',
    priceBase: 129.99,
    priceFinal: 25.99,
    discountPct: 80,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg',
    tags: ['Mundo Aberto', 'História Rica', 'Fantasia Medieval', 'Singleplayer'],
    genres: ['RPG', 'Aventura']
  },
  {
    store: 'steam',
    storeAppId: '1091500',
    title: 'Cyberpunk 2077',
    url: 'https://store.steampowered.com/app/1091500',
    priceBase: 199.99,
    priceFinal: 79.99,
    discountPct: 60,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',
    tags: ['Cyberpunk', 'Mundo Aberto', 'Futurista', 'Singleplayer'],
    genres: ['Ação', 'Aventura']
  },
  {
    store: 'steam',
    storeAppId: '1174180',
    title: 'Red Dead Redemption 2',
    url: 'https://store.steampowered.com/app/1174180',
    priceBase: 299.99,
    priceFinal: 89.99,
    discountPct: 70,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg',
    tags: ['Faroeste', 'Mundo Aberto', 'História Rica', 'Singleplayer'],
    genres: ['Aventura']
  },
  {
    store: 'steam',
    storeAppId: '1245620',
    title: 'Elden Ring',
    url: 'https://store.steampowered.com/app/1245620',
    priceBase: 249.99,
    priceFinal: 124.99,
    discountPct: 50,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
    tags: ['Soulslike', 'Fantasia', 'Mundo Aberto', 'Difícil'],
    genres: ['Ação', 'RPG']
  },
  {
    store: 'steam',
    storeAppId: '271590',
    title: 'Grand Theft Auto V',
    url: 'https://store.steampowered.com/app/271590',
    priceBase: 89.99,
    priceFinal: 22.49,
    discountPct: 75,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '990080',
    title: 'Hogwarts Legacy',
    url: 'https://store.steampowered.com/app/990080',
    priceBase: 299.99,
    priceFinal: 149.99,
    discountPct: 50,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/990080/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '230410',
    title: 'Warframe',
    url: 'https://store.steampowered.com/app/230410',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '377160',
    title: 'Fallout 4',
    url: 'https://store.steampowered.com/app/377160',
    priceBase: 129.99,
    priceFinal: 32.49,
    discountPct: 75,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/377160/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '1938090',
    title: 'Call of Duty®: Modern Warfare® III',
    url: 'https://store.steampowered.com/app/1938090',
    priceBase: 349.99,
    priceFinal: 174.99,
    discountPct: 50,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1938090/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '570',
    title: 'Dota 2',
    url: 'https://store.steampowered.com/app/570',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
    tags: ['Multiplayer', 'Competitivo', 'Free to Play', 'Esports'],
    genres: ['FPS', 'Esportes']
  },
  {
    store: 'steam',
    storeAppId: '730',
    title: 'Counter-Strike 2',
    url: 'https://store.steampowered.com/app/730',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
    tags: ['Tiro', 'Multiplayer', 'Competitivo', 'Free to Play']
  },
  {
    store: 'steam',
    storeAppId: '1086940',
    title: 'Baldurs Gate 3',
    url: 'https://store.steampowered.com/app/1086940',
    priceBase: 199.99,
    priceFinal: 159.99,
    discountPct: 20,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg',
    tags: ['Fantasia', 'Turn-Based', 'História Rica', 'Cooperativo'],
    genres: ['RPG', 'Estratégia']
  },
  {
    store: 'steam',
    storeAppId: '1203220',
    title: 'Naraka: Bladepoint',
    url: 'https://store.steampowered.com/app/1203220',
    priceBase: 79.99,
    priceFinal: 15.99,
    discountPct: 80,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1203220/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '2050650',
    title: 'Resident Evil 4',
    url: 'https://store.steampowered.com/app/2050650',
    priceBase: 249.99,
    priceFinal: 99.99,
    discountPct: 60,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/2050650/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '1172470',
    title: 'Apex Legends',
    url: 'https://store.steampowered.com/app/1172470',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '578080',
    title: 'PUBG: BATTLEGROUNDS',
    url: 'https://store.steampowered.com/app/578080',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/578080/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '381210',
    title: 'Dead by Daylight',
    url: 'https://store.steampowered.com/app/381210',
    priceBase: 79.99,
    priceFinal: 31.99,
    discountPct: 60,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/381210/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '444090',
    title: 'Paladins',
    url: 'https://store.steampowered.com/app/444090',
    priceBase: 0,
    priceFinal: 0,
    discountPct: 0,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/444090/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '72850',
    title: 'The Elder Scrolls V: Skyrim',
    url: 'https://store.steampowered.com/app/72850',
    priceBase: 99.99,
    priceFinal: 24.99,
    discountPct: 75,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/72850/header.jpg'
  },
  {
    store: 'steam',
    storeAppId: '1517290',
    title: 'Battlefield 2042',
    url: 'https://store.steampowered.com/app/1517290',
    priceBase: 299.99,
    priceFinal: 59.99,
    discountPct: 80,
    isActive: true,
    coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1517290/header.jpg'
  }
]

export const steamAdapter: StoreAdapter = {
  async fetchTrending() {
    if (env.USE_MOCK_ADAPTERS) return mockOffers
    // TODO: Implement real Steam fetching respecting TOS, or keep mock
    return mockOffers
  },
  async search(query: string) {
    if (env.USE_MOCK_ADAPTERS) {
      const q = query.toLowerCase()
      const matched = mockOffers.filter(o => o.title.toLowerCase().includes(q))
      if (matched && matched.length > 0) return matched
      // fallback: if mocks don't match, continue to real API to avoid empty results
      console.log('USE_MOCK_ADAPTERS=true but no mocks matched, tentando API real da Steam para query:', query)
    }

    try {
      // Use Steam storesearch API to get matching apps/packages
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=br&l=portuguese`
      const res = await fetch(url, { headers: { 'User-Agent': 'Looton/1.0' } })
      if (!res.ok) return []
      const data = await res.json()
      console.log('Dados recebidos da API da Steam:', data);
      const items = data.items || []
      // Map items quickly without fetching per-item prices (speed + completeness)
      const results: OfferDTO[] = items.map((it: any) => {
        const id = it.id || it.appid || it.packageid || it.bundleid
        return {
          store: 'steam',
          storeAppId: String(id),
          title: it.name || it.title || 'Jogo Steam',
          url: `https://store.steampowered.com/app/${id}`,
          // prices will be fetched on demand via /steam/price if needed
          priceBase: 0,
          priceFinal: 0,
          discountPct: 0,
          isActive: true,
          coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`
        }
      })

      return results
    } catch (err) {
      console.error('Erro ao buscar Steam:', err)
      return []
    }
  },
  async fetchByIds(ids: string[]) {
    if (env.USE_MOCK_ADAPTERS) {
      return mockOffers.filter(o => ids.includes(o.storeAppId))
    }
    return []
  }
}
