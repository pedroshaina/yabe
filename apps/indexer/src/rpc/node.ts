import { createRpcCall, type RpcClientOptions } from "./client.ts";
import {
  blockchainInfoSchema,
  blockCountSchema,
  blockHashSchema,
  blockSchema,
  type RpcBlock,
} from "./schemas.ts";

export interface BitcoinNode {
  getBlockchainInfo(): Promise<{ chain: string; blocks: number }>;
  getBlockCount(): Promise<number>;
  getBlockHash(height: number): Promise<string>;
  getBlock(hash: string): Promise<RpcBlock>;
}

export function createBitcoinNode(options: RpcClientOptions): BitcoinNode {
  const call = createRpcCall(options);
  return {
    getBlockchainInfo: () => call("getblockchaininfo", [], blockchainInfoSchema),
    getBlockCount: () => call("getblockcount", [], blockCountSchema),
    getBlockHash: (height) => call("getblockhash", [height], blockHashSchema),
    getBlock: (hash) => call("getblock", [hash, 3], blockSchema),
  };
}
