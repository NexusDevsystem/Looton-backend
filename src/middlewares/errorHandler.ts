import { FastifyInstance } from 'fastify'

export function registerErrorHandler(app: FastifyInstance) {
  // Fastify error handling is built-in, but we can set a custom error handler if needed
  // The error handler in Fastify works differently - it's typically handled through setErrorHandler or decorators
  // For now, this function can be a no-op since Fastify handles errors natively
  // Or we can set up a custom error handler if needed
}
