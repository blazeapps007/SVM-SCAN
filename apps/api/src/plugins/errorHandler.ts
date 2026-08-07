import type { FastifyInstance, FastifyError } from 'fastify'

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error)

    if (error.validation) {
      reply
        .status(400)
        .send({ error: 'Invalid request', details: error.message })
      return
    }

    const statusCode = error.statusCode ?? 500
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal server error' : error.message,
    })
  })
}
