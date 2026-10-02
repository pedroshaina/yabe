import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { Type } from 'typebox'
import { HashParam, Problem } from '../../schemas/common.js'
import { TxDetail } from './schemas.js'
import type { TransactionsService } from './service.js'

export const transactionsRoutes: FastifyPluginAsyncTypebox<{ service: TransactionsService }> = async (
  app,
  { service },
) => {
  app.get(
    '/transactions/:txid',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Transaction detail with prevouts and spending inputs',
        params: Type.Object({ txid: HashParam }),
        response: { 200: TxDetail, 400: Problem, 404: Problem },
      },
    },
    async (req) => service.getByTxid(req.params.txid),
  )
}
