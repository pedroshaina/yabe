import { MAX_TX_POSITION } from '@yabe/db'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { HashOrHeightParam, LimitQuery, Page, Problem, QueryInt } from '../../schemas/common.js'
import { BlockDetail, BlockSummary, TxSummary } from './schemas.js'
import type { BlocksService } from './service.js'

const Params = z.object({ hashOrHeight: HashOrHeightParam })

export const blocksRoutes: FastifyPluginAsyncZod<{ service: BlocksService }> = async (app, { service }) => {
  app.get(
    '/blocks',
    {
      schema: {
        tags: ['blocks'],
        summary: 'Latest blocks, newest first',
        querystring: z.object({
          before: QueryInt().min(0).max(2_147_483_647).describe('Height cursor').optional(),
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
        querystring: z.object({
          after: QueryInt().min(0).max(MAX_TX_POSITION).describe('Position cursor').optional(),
          limit: LimitQuery,
        }),
        response: { 200: Page(TxSummary), 400: Problem, 404: Problem },
      },
    },
    async (req) => service.listTransactions(req.params.hashOrHeight, req.query),
  )
}
