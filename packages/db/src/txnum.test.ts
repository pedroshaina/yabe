import { describe, expect, it } from 'vitest'
import { fromTxNum, MAX_TX_POSITION, toTxNum, txNumRangeForHeight } from './txnum.js'

describe('tx_num', () => {
  it('packs height and position into a bigint', () => {
    expect(toTxNum(800_000, 5)).toBe(838_860_800_005n)
    expect(toTxNum(0, 0)).toBe(0n)
  })

  it('round-trips', () => {
    for (const [height, position] of [
      [0, 0],
      [1, 1],
      [800_000, 5],
      [3_000_000, MAX_TX_POSITION],
    ] as const) {
      expect(fromTxNum(toTxNum(height, position))).toEqual({ height, position })
    }
  })

  it('does not overflow above 32 bits (JS << would)', () => {
    expect(toTxNum(4_096, 0)).toBe(4_294_967_296n)
  })

  it('orders by chain position', () => {
    expect(toTxNum(10, MAX_TX_POSITION)).toBeLessThan(toTxNum(11, 0))
  })

  it('rejects out-of-range input', () => {
    expect(() => toTxNum(-1, 0)).toThrow(RangeError)
    expect(() => toTxNum(1, MAX_TX_POSITION + 1)).toThrow(RangeError)
    expect(() => toTxNum(1.5, 0)).toThrow(RangeError)
  })

  it('gives the exclusive tx_num range of a block', () => {
    expect(txNumRangeForHeight(2)).toEqual({ start: toTxNum(2, 0), end: toTxNum(3, 0) })
  })
})
