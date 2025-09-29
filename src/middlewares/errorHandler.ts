import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error(error)
    const status = (error as FastifyError).statusCode || 500
    reply.status(status).send({ error: error.message || 'Internal Server Error' })
  })
}
