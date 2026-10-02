import { fromTxNum, txNumRangeForHeight, type Block } from '@yabe/db'
import { bytesToHex, hexToBytes } from '@yabe/shared'
import { notFound } from '../../errors.js'
import { confirmations } from '../chain.js'
import type { BlocksRepository } from './repository.js'
import type { BlockDetail, BlockSummary, TxSummary } from './schemas.js'

const toSummary = (block: Block): BlockSummary => ({
  height: block.height,
  hash: bytesToHex(block.hash),
  time: block.time.toISOString(),
  txCount: block.txCount,
  size: block.size,
  weight: block.weight,
  totalFee: Number(block.totalFeeSats),
  subsidy: Number(block.subsidySats),
})

const page = <T, C>(rows: T[], limit: number, cursorOf: (row: T) => C) => {
  const data = rows.slice(0, limit)
  const last = data[data.length - 1]
  return { data, nextCursor: rows.length > limit && last !== undefined ? cursorOf(last) : null }
}

export const createBlocksService = (repo: BlocksRepository) => {
  // Length decides, not digits: a 64-char hash can consist only of digits.
  const findBlock = async (hashOrHeight: string): Promise<Block> => {
    const block =
      hashOrHeight.length === 64
        ? await repo.findByHash(hexToBytes(hashOrHeight.toLowerCase()))
        : await repo.findByHeight(Number(hashOrHeight))
    if (!block) throw notFound(`Block ${hashOrHeight} not found`)
    return block
  }

  return {
    async list(query: {
      before?: number
      limit: number
    }): Promise<{ data: BlockSummary[]; nextCursor: number | null }> {
      const rows = await repo.list(query.before, query.limit + 1)
      const result = page(rows, query.limit, (b) => b.height)
      return { data: result.data.map(toSummary), nextCursor: result.nextCursor }
    },

    async get(hashOrHeight: string): Promise<BlockDetail> {
      const block = await findBlock(hashOrHeight)
      const [tip, nextHash] = await Promise.all([repo.tipHeight(), repo.findHashAtHeight(block.height + 1)])
      return {
        ...toSummary(block),
        confirmations: confirmations(block.height, tip),
        prevHash: block.prevHash ? bytesToHex(block.prevHash) : null,
        nextHash: nextHash ? bytesToHex(nextHash) : null,
        merkleRoot: bytesToHex(block.merkleRoot),
        version: block.version,
        bits: block.bits.toString(16).padStart(8, '0'),
        nonce: Number(block.nonce),
        difficulty: block.difficulty,
        medianTime: block.medianTime.toISOString(),
        strippedSize: block.strippedSize,
        chainwork: bytesToHex(block.chainwork),
        totalOut: Number(block.totalOutSats),
      }
    },

    async listTransactions(
      hashOrHeight: string,
      query: { after?: number; limit: number },
    ): Promise<{ data: TxSummary[]; nextCursor: number | null }> {
      const block = await findBlock(hashOrHeight)
      const { start, end } = txNumRangeForHeight(block.height)
      const from = query.after === undefined ? start : start + BigInt(query.after) + 1n
      const rows = await repo.listTransactions(from, end, query.limit + 1)
      const result = page(rows, query.limit, (t) => fromTxNum(t.txNum).position)
      const totals = await repo.sumOutputs(result.data.map((t) => t.txNum))
      return {
        data: result.data.map((t) => ({
          txid: bytesToHex(t.txid),
          position: fromTxNum(t.txNum).position,
          isCoinbase: t.isCoinbase,
          inputCount: t.inputCount,
          outputCount: t.outputCount,
          totalOut: Number(totals.get(t.txNum) ?? 0n),
          fee: t.feeSats === null ? null : Number(t.feeSats),
          vsize: t.vsize,
        })),
        nextCursor: result.nextCursor,
      }
    },
  }
}
export type BlocksService = ReturnType<typeof createBlocksService>
