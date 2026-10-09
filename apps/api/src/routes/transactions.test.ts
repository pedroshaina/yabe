import { createPrismaClient, type PrismaClient } from "@yabe/db";
import { startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../app.ts";
import {
  NULLDATA_HEX,
  P2WPKH_HEX,
  PUBKEY_HEX,
  SCRIPT_SIG_HEX,
  SIG_HEX,
  seedChain,
  type SeededChain,
} from "../testing/seed.ts";

interface TransactionBody {
  txid: string;
  confirmations: number;
  inputs: unknown[];
  outputs: unknown[];
}

describe("transaction and search endpoints", () => {
  let db: TestDatabase;
  let writer: PrismaClient;
  let reader: PrismaClient;
  let app: App;
  let chain: SeededChain;

  beforeAll(async () => {
    db = await startTestDatabase();
    writer = createPrismaClient(db.indexerUrl);
    reader = createPrismaClient(db.apiUrl);
    chain = await seedChain(writer);
    app = await buildApp({ prisma: reader, corsOrigins: [], logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await reader?.$disconnect();
    await writer?.$disconnect();
    await db?.stop();
  });

  const get = (url: string) => app.inject({ url });

  describe("GET /v1/transactions/{txid}", () => {
    it("returns inputs with what they spend and outputs with where they were spent", async () => {
      const response = await get(`/v1/transactions/${chain.txids.c}`);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        txid: chain.txids.c,
        blockHash: chain.blocks[1]!.hash,
        blockHeight: 1,
        blockTime: expect.any(Number) as unknown,
        position: 1,
        confirmations: 2,
        version: 2,
        locktime: 0,
        size: 200,
        vsize: 150,
        weight: 600,
        isCoinbase: false,
        feeSat: 100_000,
        feeRate: 666.667,
        inputs: [
          {
            index: 0,
            coinbaseHex: null,
            prevTxid: chain.txids.a,
            prevIndex: 0,
            valueSat: 5_000_000_000,
            address: "bcrt1qa0",
            scriptType: "witness_v0_keyhash",
            scriptSig: null,
            witness: ["3044", "02fe"],
            sequence: 0xfffffffd,
          },
        ],
        outputs: [
          {
            index: 0,
            valueSat: 1_000_000_000,
            address: "bcrt1qc0",
            scriptType: "witness_v0_keyhash",
            script: { hex: P2WPKH_HEX, asm: `0 ${"11".repeat(20)}` },
            spentBy: { txid: chain.txids.e, inputIndex: 0 },
          },
          {
            index: 1,
            valueSat: 3_999_900_000,
            address: "bcrt1qc1",
            scriptType: "witness_v0_keyhash",
            script: { hex: P2WPKH_HEX, asm: `0 ${"11".repeat(20)}` },
            spentBy: null,
          },
        ],
      });
    });

    it("decodes an input's scriptSig like Bitcoin Core, including the sighash", async () => {
      const response = (await get(`/v1/transactions/${chain.txids.e}`)).json<TransactionBody>();
      expect(response.inputs[0]).toMatchObject({
        scriptSig: { hex: SCRIPT_SIG_HEX, asm: `${SIG_HEX}[ALL] ${PUBKEY_HEX}` },
      });
      expect(response.confirmations).toBe(1);
    });

    it("returns a coinbase without fee, fee rate or spent values", async () => {
      const response = (await get(`/v1/transactions/${chain.txids.a}`)).json<TransactionBody>();
      expect(response).toMatchObject({ isCoinbase: true, feeSat: null, feeRate: null });
      expect(response.inputs[0]).toMatchObject({
        coinbaseHex: "016600",
        prevTxid: null,
        valueSat: null,
        scriptSig: null,
      });
      expect(response.outputs[1]).toMatchObject({
        address: null,
        scriptType: "nulldata",
        script: { hex: NULLDATA_HEX, asm: `OP_RETURN ${"ab".repeat(11)}` },
      });
    });

    it("accepts an uppercase txid", async () => {
      const response = await get(`/v1/transactions/${chain.txids.c.toUpperCase()}`);
      expect(response.json<TransactionBody>().txid).toBe(chain.txids.c);
    });

    it("is a 404 problem for an unknown txid and a 400 problem for a malformed one", async () => {
      expect((await get(`/v1/transactions/${"f".repeat(64)}`)).statusCode).toBe(404);
      expect((await get("/v1/transactions/nope")).statusCode).toBe(400);
    });
  });

  describe("GET /v1/search", () => {
    it("finds a block by height", async () => {
      expect((await get("/v1/search?q=1")).json()).toEqual({
        type: "block",
        hash: chain.blocks[1]!.hash,
        height: 1,
      });
    });

    it("finds a block by hash and a transaction by txid, in any case", async () => {
      expect((await get(`/v1/search?q=${chain.blocks[2]!.hash.toUpperCase()}`)).json()).toEqual({
        type: "block",
        hash: chain.blocks[2]!.hash,
        height: 2,
      });
      expect((await get(`/v1/search?q=${chain.txids.e}`)).json()).toEqual({
        type: "transaction",
        txid: chain.txids.e,
      });
    });

    it("trims surrounding whitespace", async () => {
      expect((await get(`/v1/search?q=%20${chain.txids.e}%20`)).json()).toEqual({
        type: "transaction",
        txid: chain.txids.e,
      });
    });

    it.each(["9", "f".repeat(64)])("is a 404 problem when nothing matches %s", async (q) => {
      expect((await get(`/v1/search?q=${q}`)).statusCode).toBe(404);
    });

    it.each(["", "hello", "99999999999", "f".repeat(63)])("is a 400 problem for %j", async (q) => {
      const response = await get(`/v1/search?q=${encodeURIComponent(q)}`);
      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toMatch(/problem\+json/);
    });
  });
});
