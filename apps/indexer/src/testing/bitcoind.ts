import { GenericContainer, Wait } from "testcontainers";
import { z } from "zod";
import { createRpcCall, type RpcClientOptions } from "../rpc/client.ts";
import { createBitcoinNode, type BitcoinNode } from "../rpc/node.ts";
import { createRpcAuth } from "../rpc/rpcauth.ts";

const IMAGE = "bitcoin/bitcoin:31.1";
const RPC_PORT = 18443;
const USER = "yabe";
const PASSWORD = "regtest-password";
const WALLET = "test";

export interface TestNode {
  rpc: RpcClientOptions;
  node: BitcoinNode;
  /**
   * Mines `blocks` blocks to a fresh wallet address; returns their hashes. A fresh
   * address per call makes blocks mined after `invalidate` differ from the invalidated ones.
   */
  mine(blocks: number): Promise<string[]>;
  /** Sends `btc` to a new wallet address; returns the txid (unconfirmed until mined). */
  send(btc: number): Promise<string>;
  /** Marks a block invalid: the node switches to the best chain without it. */
  invalidate(hash: string): Promise<void>;
  /** Undoes `invalidate`. */
  reconsider(hash: string): Promise<void>;
  stop(): Promise<void>;
}

/** Starts a throwaway regtest bitcoind with a funded-on-demand wallet. Callers must stop() it. */
export async function startTestNode(): Promise<TestNode> {
  const container = await new GenericContainer(IMAGE)
    .withCommand([
      "-regtest",
      "-server",
      "-rpcbind=0.0.0.0",
      "-rpcallowip=0.0.0.0/0",
      `-rpcauth=${createRpcAuth(USER, PASSWORD)}`,
      "-fallbackfee=0.0001",
    ])
    .withExposedPorts(RPC_PORT)
    .withWaitStrategy(Wait.forLogMessage(/init message: Done loading/))
    .start();

  const rpc: RpcClientOptions = {
    url: `http://${container.getHost()}:${container.getMappedPort(RPC_PORT)}`,
    user: USER,
    password: PASSWORD,
    timeoutMs: 30_000,
  };
  const call = createRpcCall(rpc);
  const wallet = createRpcCall({ ...rpc, url: `${rpc.url}/wallet/${WALLET}` });

  try {
    await call("createwallet", [WALLET], z.unknown());
  } catch (error) {
    await container.stop();
    throw error;
  }
  const newAddress = () => wallet("getnewaddress", [], z.string());

  return {
    rpc,
    node: createBitcoinNode(rpc),
    mine: async (blocks) =>
      wallet("generatetoaddress", [blocks, await newAddress()], z.array(z.string())),
    send: async (btc) => wallet("sendtoaddress", [await newAddress(), btc], z.string()),
    invalidate: async (hash) => {
      await call("invalidateblock", [hash], z.unknown());
    },
    reconsider: async (hash) => {
      await call("reconsiderblock", [hash], z.unknown());
    },
    stop: async () => {
      await container.stop();
    },
  };
}
