export type NetworkId = "signet" | "testnet" | "mainnet";

export interface Network {
  id: NetworkId;
  label: string;
  /** Whether the indexer and API serve it yet; disabled networks are listed but not selectable. */
  enabled: boolean;
}

export const NETWORKS: readonly Network[] = [
  { id: "signet", label: "Signet", enabled: true },
  { id: "testnet", label: "Testnet", enabled: false },
  { id: "mainnet", label: "Mainnet", enabled: false },
];

/** The only network served until the indexer and API support several. */
export const CURRENT_NETWORK: Network = NETWORKS[0]!;
