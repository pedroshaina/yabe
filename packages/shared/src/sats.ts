export const SATS_PER_BTC = 100_000_000

// Bitcoin Core reports amounts as BTC floats with 8 decimals; rounding after scaling is exact for every
// valid amount (max supply 2.1e15 sats < 2^53).
export const btcToSats = (btc: number): bigint => {
  if (!Number.isFinite(btc) || btc < 0) throw new RangeError(`Invalid BTC amount: ${btc}`)
  return BigInt(Math.round(btc * SATS_PER_BTC))
}
