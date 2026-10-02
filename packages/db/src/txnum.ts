// tx_num packs a transaction's chain position into one 64-bit key: (block_height << 20) | position.
// Unlike Fulcrum/ElectrumX `TxNum` (a dense global counter) it has gaps, but it is computable without
// reading the database, deterministic across re-indexes, and a block is a contiguous range.
// Must use BigInt: JS `<<` is 32-bit and silently overflows.
export const TX_POSITION_BITS = 20n
export const MAX_TX_POSITION = 2 ** 20 - 1
const POSITION_MASK = (1n << TX_POSITION_BITS) - 1n

export const toTxNum = (height: number, position: number): bigint => {
  if (!Number.isInteger(height) || height < 0) throw new RangeError(`Invalid block height: ${height}`)
  if (!Number.isInteger(position) || position < 0 || position > MAX_TX_POSITION) {
    throw new RangeError(`Invalid transaction position: ${position}`)
  }
  return (BigInt(height) << TX_POSITION_BITS) | BigInt(position)
}

export const fromTxNum = (txNum: bigint): { height: number; position: number } => ({
  height: Number(txNum >> TX_POSITION_BITS),
  position: Number(txNum & POSITION_MASK),
})

export const txNumRangeForHeight = (height: number): { start: bigint; end: bigint } => ({
  start: toTxNum(height, 0),
  end: toTxNum(height + 1, 0),
})
