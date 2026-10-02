import type { PrismaClient } from '@yabe/db'
import { getTipHeight } from '../chain.js'

export const createBlocksRepository = (prisma: PrismaClient) => ({
  list: (before: number | undefined, take: number) =>
    prisma.block.findMany({
      where: before === undefined ? {} : { height: { lt: before } },
      orderBy: { height: 'desc' },
      take,
    }),
  findByHash: (hash: Uint8Array<ArrayBuffer>) => prisma.block.findUnique({ where: { hash } }),
  findByHeight: (height: number) => prisma.block.findUnique({ where: { height } }),
  findHashAtHeight: async (height: number) =>
    (await prisma.block.findUnique({ where: { height }, select: { hash: true } }))?.hash ?? null,
  tipHeight: () => getTipHeight(prisma),
  // [fromTxNum, toTxNum) in chain order.
  listTransactions: (fromTxNum: bigint, toTxNum: bigint, take: number) =>
    prisma.transaction.findMany({
      where: { txNum: { gte: fromTxNum, lt: toTxNum } },
      orderBy: { txNum: 'asc' },
      take,
    }),
  sumOutputs: async (txNums: bigint[]): Promise<Map<bigint, bigint>> => {
    if (txNums.length === 0) return new Map()
    const rows = await prisma.txOutput.groupBy({
      by: ['txNum'],
      where: { txNum: { in: txNums } },
      _sum: { valueSats: true },
    })
    return new Map(rows.map((r) => [r.txNum, r._sum.valueSats ?? 0n]))
  },
})
export type BlocksRepository = ReturnType<typeof createBlocksRepository>
