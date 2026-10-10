import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { startTestNode, type TestNode } from "../testing/bitcoind.ts";
import { createRpcCall } from "./client.ts";
import { RpcConnectionError, RpcError, RpcHttpError, RpcResponseError } from "./errors.ts";

describe("BitcoinNode against regtest", () => {
  let t: TestNode;
  let spendTxid: string;

  beforeAll(async () => {
    t = await startTestNode();
    await t.mine(101);
    spendTxid = await t.send(1.5);
    await t.mine(1);
  });

  afterAll(async () => {
    await t?.stop();
  });

  it("reports the regtest chain", async () => {
    expect(await t.node.getBlockchainInfo()).toMatchObject({ chain: "regtest", blocks: 102 });
    expect(await t.node.getBlockCount()).toBe(102);
  });

  it("parses the genesis block", async () => {
    const genesis = await t.node.getBlock(await t.node.getBlockHash(0));

    expect(genesis.height).toBe(0);
    expect(genesis.previousblockhash).toBeUndefined();
    expect(genesis.tx[0]?.vin[0]?.coinbase).toBeDefined();
  });

  it("parses a block with a spend, including prevout and fee", async () => {
    const block = await t.node.getBlock(await t.node.getBlockHash(102));
    const spend = block.tx.find((tx) => tx.txid === spendTxid);

    expect(block.nTx).toBe(2);
    expect(spend?.fee).toBeGreaterThan(0);
    expect(spend?.vin[0]?.prevout?.value).toBe(50);
    expect(spend?.vin[0]?.prevout?.scriptPubKey.type).toBe("witness_v0_keyhash");
  });

  it("turns a node error into RpcError with the node's code", async () => {
    await expect(t.node.getBlockHash(9_999)).rejects.toMatchObject({
      name: "RpcError",
      code: -8,
      method: "getblockhash",
    });
    await expect(t.node.getBlockHash(9_999)).rejects.toBeInstanceOf(RpcError);
  });

  it("wrong password is RpcHttpError 401 without the password", async () => {
    const call = createRpcCall({ ...t.rpc, password: "wrong-password" });

    const error = await call("getblockcount", [], z.number()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcHttpError);
    expect(error).toMatchObject({ status: 401 });
    expect(String(error)).not.toMatch(/wrong-password/);
  });

  it("a result that fails validation is RpcResponseError", async () => {
    const call = createRpcCall(t.rpc);

    await expect(call("getblockcount", [], z.string())).rejects.toBeInstanceOf(RpcResponseError);
  });

  it("connection refused becomes RpcConnectionError", async () => {
    const call = createRpcCall({ ...t.rpc, url: "http://127.0.0.1:1" });

    const error = await call("getblockcount", [], z.number()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcConnectionError);
    expect(String(error)).toMatch(/127\.0\.0\.1:1/);
  });
});
