// Script temporário para popular gêneros Steam para teste
const mongoose = require('mongoose')

// Conectar ao MongoDB
async function connectMongo() {
  try {
    await mongoose.connect('mongodb://localhost:27017/looton')
    console.log('MongoDB conectado!')
  } catch (error) {
    console.error('Erro ao conectar MongoDB:', error)
    throw error
  }
}

// Definir schemas
const storeSchema = new mongoose.Schema({
  name: String,
  url: String,
  logoUrl: String,
  currency: String,
  region: String
})

const gameSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  storeAppId: String,
  steamAppId: Number,
  title: String,
  slug: String,
  coverUrl: String,
  steamGenres: [{
    id: String,
    name: String
  }],
  genreSlugs: [String]
})

const offerSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  url: String,
  priceBase: Number,
  priceFinal: Number,
  discountPct: Number,
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: Date.now }
})

const Store = mongoose.model('Store', storeSchema)
const Game = mongoose.model('Game', gameSchema)
const Offer = mongoose.model('Offer', offerSchema)

async function seedGenres() {
  try {
    await connectMongo()
    console.log('Conectado ao MongoDB')
    
    // Primeiro, criar uma store Steam
    let steamStore = await Store.findOne({ name: 'Steam' })
    if (!steamStore) {
      steamStore = await Store.create({
        name: 'Steam',
        url: 'https://store.steampowered.com',
        logoUrl: 'https://store.steampowered.com/favicon.ico',
        currency: 'BRL',
        region: 'BR'
      })
      console.log('Store Steam criada')
    }

    // Criar alguns jogos de exemplo com gêneros
    const sampleGames = [
      {
        title: 'Counter-Strike 2',
        slug: 'counter-strike-2',
        storeId: steamStore._id,
        storeAppId: '730',
        steamAppId: 730,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
        steamGenres: [
          { id: '1', name: 'Ação' },
          { id: '13', name: 'Luta' }
        ],
        genreSlugs: ['acao', 'luta']
      },
      {
        title: 'The Witcher 3: Wild Hunt',
        slug: 'the-witcher-3',
        storeId: steamStore._id,
        storeAppId: '292030',
        steamAppId: 292030,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg',
        steamGenres: [
          { id: '7', name: 'RPG' },
          { id: '2', name: 'Aventura' }
        ],
        genreSlugs: ['rpg', 'aventura']
      },
      {
        title: 'Forza Horizon 5',
        slug: 'forza-horizon-5',
        storeId: steamStore._id,
        storeAppId: '1551360',
        steamAppId: 1551360,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1551360/header.jpg',
        steamGenres: [
          { id: '6', name: 'Corrida' },
          { id: '9', name: 'Esportes' }
        ],
        genreSlugs: ['corrida', 'esportes']
      },
      {
        title: 'Stardew Valley',
        slug: 'stardew-valley',
        storeId: steamStore._id,
        storeAppId: '413150',
        steamAppId: 413150,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',
        steamGenres: [
          { id: '4', name: 'Indie' },
          { id: '8', name: 'Simulação' }
        ],
        genreSlugs: ['indie', 'simulacao']
      },
      {
        title: 'Civilization VI',
        slug: 'civilization-vi',
        storeId: steamStore._id,
        storeAppId: '289070',
        steamAppId: 289070,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/289070/header.jpg',
        steamGenres: [
          { id: '10', name: 'Estratégia' }
        ],
        genreSlugs: ['estrategia']
      },
      {
        title: 'Battlefield 2042',
        slug: 'battlefield-2042',
        storeId: steamStore._id,
        storeAppId: '1517290',
        steamAppId: 1517290,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1517290/header.jpg',
        steamGenres: [
          { id: '1', name: 'Ação' },
          { id: '5', name: 'Multijogador Massivo' }
        ],
        genreSlugs: ['acao', 'multijogador-massivo']
      },
      {
        title: 'Naraka: Bladepoint',
        slug: 'naraka-bladepoint',
        storeId: steamStore._id,
        storeAppId: '1203220',
        steamAppId: 1203220,
        coverUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1203220/header.jpg',
        steamGenres: [
          { id: '1', name: 'Ação' },
          { id: '2', name: 'Aventura' }
        ],
        genreSlugs: ['acao', 'aventura']
      }
    ]
    
    // Limpar dados existentes
    await Game.deleteMany({})
    await Offer.deleteMany({})
    console.log('Dados anteriores removidos')
    
    // Inserir jogos de exemplo
    const createdGames = []
    for (const game of sampleGames) {
      const createdGame = await Game.create(game)
      createdGames.push(createdGame)
      console.log(`Jogo criado: ${game.title}`)
    }
    
    // Dados de ofertas correspondentes aos jogos
    const offerData = [
      { gameIndex: 0, priceBase: 0, priceFinal: 0, discountPct: 0, url: 'https://store.steampowered.com/app/730' },
      { gameIndex: 1, priceBase: 129.99, priceFinal: 25.99, discountPct: 80, url: 'https://store.steampowered.com/app/292030' },
      { gameIndex: 2, priceBase: 299.99, priceFinal: 89.99, discountPct: 70, url: 'https://store.steampowered.com/app/1551360' },
      { gameIndex: 3, priceBase: 49.99, priceFinal: 24.99, discountPct: 50, url: 'https://store.steampowered.com/app/413150' },
      { gameIndex: 4, priceBase: 199.99, priceFinal: 39.99, discountPct: 80, url: 'https://store.steampowered.com/app/289070' },
      { gameIndex: 5, priceBase: 299.99, priceFinal: 59.99, discountPct: 80, url: 'https://store.steampowered.com/app/1517290' },
      { gameIndex: 6, priceBase: 79.99, priceFinal: 15.99, discountPct: 80, url: 'https://store.steampowered.com/app/1203220' }
    ]
    
    // Criar ofertas
    for (const offerInfo of offerData) {
      const game = createdGames[offerInfo.gameIndex]
      await Offer.create({
        gameId: game._id,
        storeId: steamStore._id,
        url: offerInfo.url,
        priceBase: offerInfo.priceBase,
        priceFinal: offerInfo.priceFinal,
        discountPct: offerInfo.discountPct,
        isActive: true,
        lastSeenAt: new Date()
      })
      console.log(`Oferta criada para: ${game.title}`)
    }
    
    console.log('✅ Seed concluído! Jogos, gêneros e ofertas populados.')
    process.exit(0)
    
  } catch (error) {
    console.error('Erro no seed:', error)
    process.exit(1)
  }
}

seedGenres()