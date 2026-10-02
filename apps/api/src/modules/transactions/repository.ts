import type { PrismaClient } from '@yabe/db'
import { getTipHeight } from '../chain.js'

export const createTransactionsRepository = (prisma: PrismaClient) => ({
  // txid is not unique (BIP30); the newest occurrence wins, matching Bitcoin Core.
  findByTxid: (txid: Uint8Array<ArrayBuffer>) =>
    prisma.transaction.findFirst({
      where: { txid },
      orderBy: { txNum: 'desc' },
      include: {
        block: { select: { height: true, hash: true, time: true } },
        inputs: { orderBy: { vin: 'asc' } },
        outputs: { orderBy: { vout: 'asc' } },
      },
    }),
  findOutputs: async (refs: { txNum: bigint; vout: number }[]) =>
    refs.length === 0
      ? []
      : prisma.txOutput.findMany({
          where: { OR: refs.map((r) => ({ txNum: r.txNum, vout: r.vout })) },
          include: { transaction: { select: { txid: true } } },
        }),
  findSpenders: (txNum: bigint) =>
    prisma.txInput.findMany({
      where: { prevTxNum: txNum },
      select: { vin: true, prevVout: true, transaction: { select: { txid: true } } },
    }),
  tipHeight: () => getTipHeight(prisma),
})
export type TransactionsRepository = ReturnType<typeof createTransactionsRepository>
