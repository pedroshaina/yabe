import { halvingInterval, type Network } from "./network.ts";

const INITIAL_SUBSIDY_SAT = 5_000_000_000n;

/**
 * The block reward allowed by consensus, excluding fees. Derived from height
 * rather than the coinbase, because a miner may claim less than allowed.
 */
export function blockSubsidySat(height: number, network: Network): bigint {
  const halvings = Math.floor(height / halvingInterval(network));
  if (halvings >= 64) {
    return 0n;
  }
  return INITIAL_SUBSIDY_SAT >> BigInt(halvings);
}
