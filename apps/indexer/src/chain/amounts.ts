const SATS_PER_BTC = 100_000_000;
/** No valid amount exceeds the 21M BTC supply. */
const MAX_BTC = 21_000_000;

/**
 * Converts a BTC amount as Bitcoin Core reports it (a JSON number with up to
 * 8 decimals) to integer satoshis. Rounding absorbs binary floating-point
 * error, which stays below 0.5 sat for every amount up to the 21M BTC supply.
 */
export function btcToSats(btc: number): bigint {
  if (!Number.isFinite(btc) || btc < 0 || btc > MAX_BTC) {
    throw new RangeError(`invalid BTC amount: ${btc}`);
  }
  return BigInt(Math.round(btc * SATS_PER_BTC));
}
