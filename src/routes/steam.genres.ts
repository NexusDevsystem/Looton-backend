import { FastifyInstance } from 'fastify'
import { getAvailableSteamGenres } from '../services/steamGenres.service.js'

export async function steamGenresRoutes(fastify: FastifyInstance) {
  // GET /steam/genres
  fastify.get('/steam/genres', {
    schema: {
      tags: ['Steam'],
      description: 'Listar todos os gêneros Steam disponíveis',
      response: {
        200: {
          type: 'object',
          properties: {
            genres: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const genres = await getAvailableSteamGenres()
      
      return reply.send({ genres })
    } catch (error) {
      console.error('Erro ao buscar gêneros Steam:', error)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}