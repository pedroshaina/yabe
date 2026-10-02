import { expect, it } from 'vitest'
import { subsidyFor } from './subsidy.js'

it.each([
  [0, 'main', 5_000_000_000n],
  [209_999, 'main', 5_000_000_000n],
  [210_000, 'main', 2_500_000_000n],
  [840_000, 'main', 312_500_000n],
  [210_000, 'signet', 2_500_000_000n],
  [149, 'regtest', 5_000_000_000n],
  [150, 'regtest', 2_500_000_000n],
  [64 * 210_000, 'main', 0n],
] as const)('subsidy at height %s on %s is %s sats', (height, network, sats) => {
  expect(subsidyFor(height, network)).toBe(sats)
})
