import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { Problem } from '../../schemas/common.js'
import { Status } from './schemas.js'
import type { StatusService } from './service.js'

export const statusRoutes: FastifyPluginAsyncZod<{ service: StatusService }> = async (app, { service }) => {
  app.get(
    '/status',
    {
      schema: {
        tags: ['status'],
        summary: 'Indexer sync progress',
        response: { 200: Status, 503: Problem },
      },
    },
    async () => service.get(),
  )
}
