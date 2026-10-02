import type { PrismaClient } from '@yabe/db'
import { HttpError } from '../../errors.js'
import type { Status } from './schemas.js'

export const createStatusService = (prisma: PrismaClient) => ({
  async get(): Promise<Status> {
    const state = await prisma.syncState.findUnique({ where: { id: 1 } })
    if (!state) throw new HttpError(503, 'The indexer has not reported any progress yet')
    return {
      network: state.network,
      nodeTipHeight: state.nodeTipHeight,
      indexedTipHeight: state.indexedTipHeight,
      lag: Math.max(0, state.nodeTipHeight - state.indexedTipHeight),
      updatedAt: state.updatedAt.toISOString(),
    }
  },
})
export type StatusService = ReturnType<typeof createStatusService>
