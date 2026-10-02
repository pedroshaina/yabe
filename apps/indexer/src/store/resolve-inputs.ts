import { bytesToHex, hexToBytes } from '@yabe/shared'
import type { BlockData, Bytes, InputRow } from '../transform/types.js'

// Maps txid (hex) → tx_num. When a txid is duplicated (BIP30), it must return the newest tx_num.
export type TxNumLookup = (txids: Bytes[]) => Promise<Map<string, bigint>>

export class UnresolvedPrevoutError extends Error {
  override name = 'UnresolvedPrevoutError'
}

export const resolveInputs = async (data: BlockData, lookup: TxNumLookup): Promise<InputRow[]> => {
  // Transactions in this block take precedence: a spend of an earlier tx in the same block, and the
  // newest occurrence of a duplicated txid.
  const inBlock = new Map<string, bigint>()
  for (const tx of data.transactions) inBlock.set(bytesToHex(tx.txid), tx.txNum)

  const external = [
    ...new Set(
      data.inputs.flatMap((i) => (i.prevTxid !== null && !inBlock.has(i.prevTxid) ? [i.prevTxid] : [])),
    ),
  ]
  const found = external.length > 0 ? await lookup(external.map(hexToBytes)) : new Map<string, bigint>()

  return data.inputs.map(({ prevTxid, ...input }) => {
    if (prevTxid === null) return { ...input, prevTxNum: null }
    const prevTxNum = inBlock.get(prevTxid) ?? found.get(prevTxid)
    if (prevTxNum === undefined) {
      throw new UnresolvedPrevoutError(
        `Input ${input.txNum}:${input.vin} spends ${prevTxid}:${input.prevVout}, which is not indexed`,
      )
    }
    return { ...input, prevTxNum }
  })
}
