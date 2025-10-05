import { FastifyInstance } from 'fastify'

export default async function epicRoutes(app: FastifyInstance) {
  // Endpoint para detalhes de jogos Epic
  app.get('/epic/details/:gameId', async (request, reply) => {
    try {
      const { gameId } = request.params as { gameId: string }
      
      // Dados detalhados dos jogos Epic Games populares
      const epicGameDetails: Record<string, any> = {
        'assassins-creed-valhalla': {
          id: 'assassins-creed-valhalla',
          title: "Assassin's Creed Valhalla",
          description: "Torne-se Eivor, um lendário invasor viking em busca de glória. Explore um mundo aberto dinâmico e bonito situado na Inglaterra da Era das Trevas. Invada seus inimigos, faça crescer seu assentamento e construa seu poder político.",
          longDescription: "Assassin's Creed Valhalla é um jogo de ação e aventura em terceira pessoa que coloca os jogadores no controle de Eivor, um invasor viking que deve ganhar um lugar entre os deuses no Valhalla. O jogo apresenta combate visceral, personalização profunda de personagens e um sistema de assentamento onde os jogadores podem construir e personalizar seus próprios assentamentos vikings.",
          releaseDate: "2020-11-10",
          developer: "Ubisoft Montreal",
          publisher: "Ubisoft",
          platforms: ["PC", "PlayStation", "Xbox"],
          genres: ["Ação", "Aventura", "RPG"],
          tags: ["Mundo Aberto", "Vikings", "Medieval", "Singleplayer", "História"],
          systemRequirements: {
            minimum: {
              os: "Windows 10 64-bit",
              processor: "Intel Core i5-4460 / AMD FX-6300",
              memory: "8 GB RAM",
              graphics: "NVIDIA GeForce GTX 960 4GB / AMD R9 380 4GB",
              directx: "Version 12",
              storage: "50 GB available space"
            },
            recommended: {
              os: "Windows 10 64-bit",
              processor: "Intel Core i7-6700HQ / AMD Ryzen 7 1700",
              memory: "16 GB RAM", 
              graphics: "NVIDIA GeForce GTX 1080 / AMD RX Vega 64",
              directx: "Version 12",
              storage: "50 GB available space"
            }
          },
          screenshots: [
            "https://cdn1.epicgames.com/offer/c4763f236d08423eb47b4c3008779c84/EGS_AssassinsCreedValhalla_Ubisoft_S1_2560x1440-b2e9b8ce7de2de38a66ad62ac8d4c136"
          ],
          rating: "M - Mature 17+"
        },
        'borderlands-3': {
          id: 'borderlands-3',
          title: 'Borderlands 3',
          description: "O jogo de tiro e saque original está de volta, repleto de armas e uma aventura caótica! Embarque em uma odisseia épica em múltiplos mundos e jogue como um dos quatro novos Caçadores de Atlas em sua busca para parar os gêmeos Calypso.",
          longDescription: "Borderlands 3 é a continuação da série aclamada de jogos de tiro e saque. Com bilhões de armas e aventura caótica, os jogadores irão rasgar mundos como um dos quatro novos Caçadores de Abóbadas - os derradeiros caçadores de tesouros em busca de poder supremo.",
          releaseDate: "2019-09-13",
          developer: "Gearbox Software",
          publisher: "2K Games",
          platforms: ["PC", "PlayStation", "Xbox"],
          genres: ["Ação", "RPG", "Shooter"],
          tags: ["Cooperativo", "Loot", "Humor", "Mundo Aberto", "FPS"],
          systemRequirements: {
            minimum: {
              os: "Windows 7/10 64-bit",
              processor: "AMD FX-8350 / Intel i5-3570",
              memory: "6 GB RAM",
              graphics: "AMD Radeon HD 7970 / NVIDIA GeForce GTX 680 2GB",
              directx: "Version 11",
              storage: "75 GB available space"
            },
            recommended: {
              os: "Windows 7/10 64-bit",
              processor: "AMD Ryzen 5 2600 / Intel i7-4770",
              memory: "16 GB RAM",
              graphics: "AMD Radeon RX 590 / NVIDIA GeForce GTX 1060 6GB",
              directx: "Version 12",
              storage: "75 GB available space"
            }
          },
          screenshots: [
            "https://cdn1.epicgames.com/offer/396e14155ed04571b2d5b8b80fa48234/EGS_Borderlands3_GearboxSoftware_S1_2560x1440-fbdf3cbc2980749091d52751ffabb1b7"
          ],
          rating: "M - Mature 17+"
        },
        'fortnite': {
          id: 'fortnite',
          title: 'Fortnite',
          description: "Fortnite é o jogo Battle Royale gratuito sempre em evolução de 100 jogadores da Epic Games. Pule do ônibus da batalha e lute para ser o último jogador em pé, construindo fortes e superando a competição.",
          longDescription: "Fortnite Battle Royale é um jogo gratuito para 100 jogadores onde você compete para ser o último sobrevivente. Construa fortes, supere a competição e lute pela Vitória Coroa. Baixe agora e salte na ação!",
          releaseDate: "2017-07-25",
          developer: "Epic Games",
          publisher: "Epic Games",
          platforms: ["PC", "Mobile", "PlayStation", "Xbox", "Nintendo Switch"],
          genres: ["Ação", "Battle Royale", "Shooter"],
          tags: ["Construção", "PvP", "Online", "Gratuito", "Multiplayer"],
          systemRequirements: {
            minimum: {
              os: "Windows 7/8/10 64-bit",
              processor: "Core i3-3225 3.3 GHz",
              memory: "4 GB RAM",
              graphics: "Intel HD 4000",
              directx: "Version 11",
              storage: "15 GB available space"
            },
            recommended: {
              os: "Windows 10 64-bit",
              processor: "Core i5-7300U 2.6 GHz",
              memory: "8 GB RAM",
              graphics: "Nvidia GTX 960, AMD R9 280, or equivalent DX11 GPU",
              directx: "Version 11",
              storage: "15 GB available space"
            }
          },
          screenshots: [
            "https://cdn1.epicgames.com/offer/fn/Fortnite%2520-%2520Chapter%25205%2520-%2520Season%25201_2560x1440_2560x1440-95718a8046a942675a0bc4d27560e2bb"
          ],
          rating: "T - Teen"
        }
      }
      
      const gameDetail = epicGameDetails[gameId]
      
      if (!gameDetail) {
        return reply.status(404).send({
          error: 'Game not found',
          message: `Epic Game with ID ${gameId} not found`
        })
      }
      
      return reply.send(gameDetail)
    } catch (error) {
      console.error('Error in Epic details route:', error)
      return reply.status(500).send({
        error: 'Failed to fetch game details',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}