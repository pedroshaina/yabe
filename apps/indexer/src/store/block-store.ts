import { toTxNum, type Prisma, type PrismaClient } from '@yabe/db'
import { bytesToHex, type Network } from '@yabe/shared'
import type { BlockData } from '../transform/types.js'
import { chunk } from './chunk.js'
import { resolveInputs, type TxNumLookup } from './resolve-inputs.js'

// Postgres allows 65,535 bind parameters per statement; 5,000 rows × ≤7 columns stays well below it.
const ROWS_PER_STATEMENT = 5_000

export interface StoredTip {
  height: number
  hash: string
}

export interface SyncStore {
  getTip(): Promise<StoredTip | null>
  getHashAt(height: number): Promise<string | null>
  writeBlock(data: BlockData, nodeTipHeight: number): Promise<void>
  rollbackFrom(height: number): Promise<void>
  recordNodeTip(nodeTipHeight: number): Promise<void>
}

type Db = PrismaClient | Prisma.TransactionClient

const txNumLookup =
  (db: Db): TxNumLookup =>
  async (txids) => {
    const found = new Map<string, bigint>()
    for (const part of chunk(txids, ROWS_PER_STATEMENT)) {
      const rows = await db.transaction.findMany({
        where: { txid: { in: part } },
        select: { txid: true, txNum: true },
        orderBy: { txNum: 'asc' },
      })
      // Ascending order, so the newest duplicate (BIP30) is set last and wins.
      for (const row of rows) found.set(bytesToHex(row.txid), row.txNum)
    }
    return found
  }

export class BlockStore implements SyncStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly network: Network,
    private readonly transactionTimeoutMs = 120_000,
  ) {}

  async getTip(): Promise<StoredTip | null> {
    const row = await this.prisma.block.findFirst({
      orderBy: { height: 'desc' },
      select: { height: true, hash: true },
    })
    return row ? { height: row.height, hash: bytesToHex(row.hash) } : null
  }

  async getHashAt(height: number): Promise<string | null> {
    const row = await this.prisma.block.findUnique({ where: { height }, select: { hash: true } })
    return row ? bytesToHex(row.hash) : null
  }

  async writeBlock(data: BlockData, nodeTipHeight: number): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const inputs = await resolveInputs(data, txNumLookup(tx))
        await tx.block.create({ data: data.block })
        for (const part of chunk(data.transactions, ROWS_PER_STATEMENT))
          await tx.transaction.createMany({ data: part })
        for (const part of chunk(data.outputs, ROWS_PER_STATEMENT))
          await tx.txOutput.createMany({ data: part })
        for (const part of chunk(inputs, ROWS_PER_STATEMENT)) await tx.txInput.createMany({ data: part })
        await this.upsertSyncState(tx, nodeTipHeight, data.block.height)
      },
      { timeout: this.transactionTimeoutMs, maxWait: 10_000 },
    )
  }

  // Removes every block at or above `height`, children first (FKs have no cascades).
  async rollbackFrom(height: number): Promise<void> {
    const fromTxNum = toTxNum(height, 0)
    await this.prisma.$transaction(
      async (tx) => {
        await tx.txInput.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.txOutput.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.transaction.deleteMany({ where: { txNum: { gte: fromTxNum } } })
        await tx.block.deleteMany({ where: { height: { gte: height } } })
        await tx.syncState.updateMany({ data: { indexedTipHeight: height - 1, updatedAt: new Date() } })
      },
      { timeout: this.transactionTimeoutMs, maxWait: 10_000 },
    )
  }

  async recordNodeTip(nodeTipHeight: number): Promise<void> {
    const tip = await this.getTip()
    await this.upsertSyncState(this.prisma, nodeTipHeight, tip?.height ?? -1)
  }

  private async upsertSyncState(db: Db, nodeTipHeight: number, indexedTipHeight: number): Promise<void> {
    const state = { network: this.network, nodeTipHeight, indexedTipHeight, updatedAt: new Date() }
    await db.syncState.upsert({ where: { id: 1 }, create: { id: 1, ...state }, update: state })
  }
}
