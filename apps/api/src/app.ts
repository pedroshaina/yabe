import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { PrismaClient } from '@yabe/db'
import type { Logger } from '@yabe/shared'
import Fastify, { type FastifyError } from 'fastify'
import { HttpError, PROBLEM_CONTENT_TYPE, problem } from './errors.js'
import { statusRoutes } from './modules/status/routes.js'
import { createStatusService } from './modules/status/service.js'

export interface AppOptions {
  prisma: PrismaClient
  logger: Logger
  corsOrigins: string[]
  rateLimitMax: number
}

export const buildApp = async ({ prisma, logger, corsOrigins, rateLimitMax }: AppOptions) => {
  const app = Fastify({ loggerInstance: logger }).withTypeProvider<TypeBoxTypeProvider>()

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
    if (status >= 500 && !(err instanceof HttpError)) {
      req.log.error({ err }, 'unhandled error')
      return reply.code(500).type(PROBLEM_CONTENT_TYPE).send(problem(500))
    }
    return reply.code(status).type(PROBLEM_CONTENT_TYPE).send(problem(status, err.message))
  })
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .type(PROBLEM_CONTENT_TYPE)
      .send(problem(404, `Route ${req.method} ${req.url} not found`)),
  )

  // CSP is disabled because the API serves JSON only and Swagger UI ships inline scripts.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: corsOrigins.length > 0 ? corsOrigins : false, methods: ['GET'] })
  await app.register(rateLimit, { max: rateLimitMax, timeWindow: '1 minute' })
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'YABE API',
        version: '1.0.0',
        description: 'Yet Another Block Explorer — Bitcoin blocks and transactions. Amounts are in satoshis.',
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  app.addHook('onSend', async (req, reply, payload) => {
    if (req.method === 'GET' && reply.statusCode === 200 && !reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'public, max-age=10')
    }
    return payload
  })

  await app.register(
    async (v1) => {
      await v1.register(statusRoutes, { service: createStatusService(prisma) })
    },
    { prefix: '/v1' },
  )

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
