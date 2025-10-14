import { getAvailableSteamGenres } from '../services/steamGenres.service.js'

export async function steamGenresRoutes(app: any) {
  // GET /steam/genres
  app.get('/steam/genres', async (req: any, res: any) => {
    try {
      const genres = await getAvailableSteamGenres()
      return res.send({ genres })
    } catch (error) {
      console.error('Erro ao buscar gêneros Steam:', error)
      return res.status(500).send({ error: 'Erro interno do servidor' })
    }
  })
}