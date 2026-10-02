import { describe, expect, it } from 'vitest'
import { btcToSats } from './sats.js'

describe('btcToSats', () => {
  it.each([
    [0, 0n],
    [0.00000001, 1n],
    [0.1, 10_000_000n],
    [0.29, 29_000_000n],
    [1.23456789, 123_456_789n],
    [50, 5_000_000_000n],
    [20999999.99999999, 2_099_999_999_999_999n],
  ])('converts %s BTC to %s sats without float drift', (btc, sats) => {
    expect(btcToSats(btc)).toBe(sats)
  })

  it('rejects negative and non-finite amounts', () => {
    expect(() => btcToSats(-1)).toThrow(RangeError)
    expect(() => btcToSats(Number.NaN)).toThrow(RangeError)
    expect(() => btcToSats(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
