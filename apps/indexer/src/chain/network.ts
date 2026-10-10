export const NETWORKS = ["mainnet", "testnet", "signet", "regtest"] as const;
export type Network = (typeof NETWORKS)[number];

const CHAIN_NAMES: Record<Network, string> = {
  mainnet: "main",
  testnet: "test",
  signet: "signet",
  regtest: "regtest",
};

/** The `chain` value Bitcoin Core reports in `getblockchaininfo` for this network. */
export function nodeChainName(network: Network): string {
  return CHAIN_NAMES[network];
}

export function halvingInterval(network: Network): number {
  return network === "regtest" ? 150 : 210_000;
}
