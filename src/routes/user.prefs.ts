import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { User } from '../db/models/User.js'

const PreferencesSchema = z.object({
  preferredSteamGenreIds: z.array(z.string().regex(/^\d+$/)).nonempty().max(20),
  minDiscount: z.number().min(0).max(100).default(0).optional(),
  stores: z.array(z.string()).optional()
})

export async function userPreferencesRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação (assumindo que já existe)
  const authGuard = async (request: any, reply: any) => {
    try {
      // Implementar validação do token JWT aqui
      // Por enquanto, assumindo que request.user já existe
      if (!request.user?.id) {
        return reply.code(401).send({ error: 'Token de autenticação requerido' })
      }
    } catch (error) {
      return reply.code(401).send({ error: 'Token inválido' })
    }
  }

  // GET /users/me/preferences
  fastify.get('/users/me/preferences', {
    preHandler: [authGuard],
    schema: {
      tags: ['User Preferences'],
      description: 'Obter preferências do usuário logado',
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
      const userId = request.user.id
      const user = await User.findById(userId).lean()

      if (!user) {
        return reply.code(404).send({ error: 'Usuário não encontrado' })
      }

      const preferences = user.preferences || {
        preferredSteamGenreIds: [],
        minDiscount: 0,
        stores: []
      }

      return reply.send({ preferences })
    } catch (error) {
      console.error('Erro ao buscar preferências do usuário:', error)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })

  // PATCH /users/me/preferences
  fastify.patch('/users/me/preferences', {
    preHandler: [authGuard],
    schema: {
      tags: ['User Preferences'],
      description: 'Atualizar preferências do usuário logado',
      body: {
        type: 'object',
        properties: {
          preferredSteamGenreIds: { 
            type: 'array', 
            items: { 
              type: 'string',
              pattern: '^\\d+$'
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
      const userId = request.user.id
      const body = PreferencesSchema.parse(request.body)

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            preferences: {
              preferredSteamGenreIds: body.preferredSteamGenreIds,
              minDiscount: body.minDiscount ?? 0,
              stores: body.stores ?? []
            }
          }
        },
        { new: true, upsert: false }
      ).lean()

      if (!updatedUser) {
        return reply.code(404).send({ error: 'Usuário não encontrado' })
      }

      console.log(`Preferências atualizadas para usuário ${userId}:`, updatedUser.preferences)

      return reply.send({ 
        success: true, 
        preferences: updatedUser.preferences 
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos', 
          details: error.errors 
        })
      }

      console.error('Erro ao atualizar preferências do usuário:', error)
      return reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  })
}