import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { MAX_TX_POSITION } from '@yabe/db'
import { Type } from 'typebox'
import { HashOrHeightParam, LimitQuery, Page, Problem } from '../../schemas/common.js'
import { BlockDetail, BlockSummary, TxSummary } from './schemas.js'
import type { BlocksService } from './service.js'

const Params = Type.Object({ hashOrHeight: HashOrHeightParam })

export const blocksRoutes: FastifyPluginAsyncTypebox<{ service: BlocksService }> = async (
  app,
  { service },
) => {
  app.get(
    '/blocks',
    {
      schema: {
        tags: ['blocks'],
        summary: 'Latest blocks, newest first',
        querystring: Type.Object({
          before: Type.Optional(
            Type.Integer({ minimum: 0, maximum: 2_147_483_647, description: 'Height cursor' }),
          ),
          limit: LimitQuery,
        }),
        response: { 200: Page(BlockSummary), 400: Problem },
      },
    },
    async (req) => service.list(req.query),
  )

  app.get(
    '/blocks/:hashOrHeight',
    {
      schema: {
        tags: ['blocks'],
        summary: 'Block detail',
        params: Params,
        response: { 200: BlockDetail, 400: Problem, 404: Problem },
      },
    },
    async (req) => service.get(req.params.hashOrHeight),
  )

  app.get(
    '/blocks/:hashOrHeight/transactions',
    {
      schema: {
        tags: ['blocks'],
        summary: "A block's transactions in block order",
        params: Params,
        querystring: Type.Object({
          after: Type.Optional(
            Type.Integer({ minimum: 0, maximum: MAX_TX_POSITION, description: 'Position cursor' }),
          ),
          limit: LimitQuery,
        }),
        response: { 200: Page(TxSummary), 400: Problem, 404: Problem },
      },
    },
    async (req) => service.listTransactions(req.params.hashOrHeight, req.query),
  )
}
