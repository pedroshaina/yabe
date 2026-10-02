import type { Network } from '@yabe/shared'

const HALVING_INTERVAL: Record<Network, number> = {
  main: 210_000,
  test: 210_000,
  testnet4: 210_000,
  signet: 210_000,
  regtest: 150,
}
const INITIAL_SUBSIDY_SATS = 5_000_000_000n

export const subsidyFor = (height: number, network: Network): bigint => {
  const halvings = Math.floor(height / HALVING_INTERVAL[network])
  return halvings >= 64 ? 0n : INITIAL_SUBSIDY_SATS >> BigInt(halvings)
}
