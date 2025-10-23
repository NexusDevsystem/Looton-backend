import { FastifyInstance } from 'fastify'
import { z } from 'zod'

// Cache em memória para preferências (sem autenticação de usuário)
const preferencesCache = new Map<string, any>()

const PreferencesSchema = z.object({
  preferredSteamGenreIds: z.array(z.string().regex(/^\\d+$/)).nonempty().max(20),
  minDiscount: z.number().min(0).max(100).default(0).optional(),
  stores: z.array(z.string()).optional()
})

export async function userPreferencesRoutes(fastify: FastifyInstance) {
  // GET /preferences - Retorna preferências genéricas (sem autenticação)
  fastify.get('/preferences', {
    schema: {
      tags: ['Preferences'],
      description: 'Obter preferências padrão',
      response: {
        200: {
          type: 'object',
          properties: {
            preferences: {
              type: 'object',
              properties: {
                preferredSteamGenreIds: { type: 'array', items: { type: 'string' } },
                minDiscount: { type: 'number' },
                stores: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const preferences = preferencesCache.get('default') || {
        preferredSteamGenreIds: [],
        minDiscount: 0,
        stores: []
      }

      return reply.send({ preferences })
    } catch (error) {
      console.error('Erro ao buscar preferências:', error)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // PATCH /preferences - Atualiza preferências padrão (sem autenticação)
  fastify.patch('/preferences', {
    schema: {
      tags: ['Preferences'],
      description: 'Atualizar preferências padrão',
      body: {
        type: 'object',
        properties: {
          preferredSteamGenreIds: { 
            type: 'array', 
            items: { 
              type: 'string',
              pattern: '^\\\\\\\\d+'
            },
            minItems: 1,
            maxItems: 20
          },
          minDiscount: { 
            type: 'number', 
            minimum: 0, 
            maximum: 100 
          },
          stores: { 
            type: 'array', 
            items: { type: 'string' } 
          }
        },
        required: ['preferredSteamGenreIds']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            preferences: {
              type: 'object',
              properties: {
                preferredSteamGenreIds: { type: 'array', items: { type: 'string' } },
                minDiscount: { type: 'number' },
                stores: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const body = PreferencesSchema.parse(request.body)

      const preferences = {
        preferredSteamGenreIds: body.preferredSteamGenreIds,
        minDiscount: body.minDiscount ?? 0,
        stores: body.stores ?? []
      }

      // Armazenar no cache como preferências padrão
      preferencesCache.set('default', preferences)

      console.log('Preferências padrão atualizadas:', preferences)

      return reply.send({ 
        success: true, 
        preferences 
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos', 
          details: error.errors 
        })
      }

      console.error('Erro ao atualizar preferências:', error)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}