import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { HashParam, Problem } from '../../schemas/common.js'
import { TxDetail } from './schemas.js'
import type { TransactionsService } from './service.js'

export const transactionsRoutes: FastifyPluginAsyncZod<{ service: TransactionsService }> = async (
  app,
  { service },
) => {
  app.get(
    '/transactions/:txid',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Transaction detail with prevouts and spending inputs',
        params: z.object({ txid: HashParam }),
        response: { 200: TxDetail, 400: Problem, 404: Problem },
      },
    },
    async (req) => service.getByTxid(req.params.txid),
  )
}
