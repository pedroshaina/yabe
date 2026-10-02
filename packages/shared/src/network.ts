// Values match `getblockchaininfo.chain` in Bitcoin Core.
export const NETWORKS = ['main', 'test', 'testnet4', 'signet', 'regtest'] as const
export type Network = (typeof NETWORKS)[number]
