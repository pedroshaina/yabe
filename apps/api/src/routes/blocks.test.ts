import { createPrismaClient, type PrismaClient } from "@yabe/db";
import { blockData, startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../app.ts";
import { seedChain, type SeededChain } from "../testing/seed.ts";

interface BlockPage {
  blocks: { height: number }[];
  next: number | null;
}
interface TransactionPage {
  transactions: { position: number }[];
  next: number | null;
}

describe("block endpoints", () => {
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

  describe("GET /v1/blocks", () => {
    it("lists newest first with a cursor to the next page", async () => {
      const first = (await get("/v1/blocks?limit=2")).json<BlockPage>();
      expect(first.blocks.map((b) => b.height)).toEqual([2, 1]);
      expect(first.next).toBe(1);
      expect(first.blocks[0]).toEqual({
        height: 2,
        hash: chain.blocks[2]!.hash,
        time: Number(blockData(2).time),
        txCount: 2,
        size: 285,
        weight: 1032,
        totalFeeSat: 10_000,
      });

      const second = (await get("/v1/blocks?limit=2&before=1")).json<BlockPage>();
      expect(second.blocks.map((b) => b.height)).toEqual([0]);
      expect(second.next).toBeNull();
    });

    it("returns an empty final page at the start of the chain", async () => {
      expect((await get("/v1/blocks?before=0")).json()).toEqual({ blocks: [], next: null });
    });

    it("has no next cursor when the page ends on genesis", async () => {
      expect((await get("/v1/blocks?limit=3")).json<BlockPage>().next).toBeNull();
    });

    it.each(["limit=0", "limit=101", "limit=abc", "before=-1", "before=99999999999"])(
      "rejects %s with a 400 problem",
      async (query) => {
        const response = await get(`/v1/blocks?${query}`);
        expect(response.statusCode).toBe(400);
        expect(response.headers["content-type"]).toMatch(/problem\+json/);
      },
    );

    it("is a 503 problem when the database is down", async () => {
      const down = createPrismaClient("postgresql://yabe_api:x@127.0.0.1:1/yabe", {
        connectionTimeoutMs: 500,
      });
      const offline = await buildApp({ prisma: down, corsOrigins: [], logger: false });
      try {
        expect((await offline.inject({ url: "/v1/blocks" })).statusCode).toBe(503);
      } finally {
        await offline.close();
        await down.$disconnect();
      }
    });
  });

  describe("GET /v1/blocks/{hashOrHeight}", () => {
    it("returns a block by height with computed confirmations, reward and next hash", async () => {
      const response = await get("/v1/blocks/1");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        height: 1,
        hash: chain.blocks[1]!.hash,
        prevHash: chain.blocks[0]!.hash,
        nextBlockHash: chain.blocks[2]!.hash,
        confirmations: 2,
        txCount: 2,
        subsidySat: 5_000_000_000,
        totalFeeSat: 100_000,
        rewardSat: 5_000_100_000,
      });
    });

    it("returns the same block by hash, in any case", async () => {
      const lower = (await get(`/v1/blocks/${chain.blocks[1]!.hash}`)).json<{ height: number }>();
      const upper = (
        await get(`/v1/blocks/${chain.blocks[1]!.hash.toUpperCase()}`)
      ).json<unknown>();
      expect(upper).toEqual(lower);
      expect(lower.height).toBe(1);
    });

    it("has no next hash and one confirmation at the tip", async () => {
      expect((await get("/v1/blocks/2")).json()).toMatchObject({
        nextBlockHash: null,
        confirmations: 1,
      });
    });

    it.each(["9", "f".repeat(64)])("is a 404 problem for unknown %s", async (id) => {
      expect((await get(`/v1/blocks/${id}`)).statusCode).toBe(404);
    });

    it.each(["xyz", "abc123", "99999999999", "f".repeat(63)])(
      "is a 400 problem for %s",
      async (id) => {
        expect((await get(`/v1/blocks/${id}`)).statusCode).toBe(400);
      },
    );
  });

  describe("GET /v1/blocks/{hash}/transactions", () => {
    it("lists a block's transactions in order with totals", async () => {
      const response = (
        await get(`/v1/blocks/${chain.blocks[1]!.hash}/transactions`)
      ).json<unknown>();
      expect(response).toEqual({
        transactions: [
          {
            txid: chain.txids.b,
            position: 0,
            isCoinbase: true,
            feeSat: null,
            vsize: 150,
            inputCount: 1,
            outputCount: 1,
            totalInSat: null,
            totalOutSat: 5_000_100_000,
          },
          {
            txid: chain.txids.c,
            position: 1,
            isCoinbase: false,
            feeSat: 100_000,
            vsize: 150,
            inputCount: 1,
            outputCount: 2,
            totalInSat: 5_000_000_000,
            totalOutSat: 4_999_900_000,
          },
        ],
        next: null,
      });
    });

    it("paginates by position", async () => {
      const base = `/v1/blocks/${chain.blocks[1]!.hash}/transactions`;
      const first = (await get(`${base}?limit=1`)).json<TransactionPage>();
      expect(first.transactions.map((t) => t.position)).toEqual([0]);
      expect(first.next).toBe(0);

      const second = (await get(`${base}?limit=1&after=0`)).json<TransactionPage>();
      expect(second.transactions.map((t) => t.position)).toEqual([1]);

      const past = (await get(`${base}?after=5`)).json<unknown>();
      expect(past).toEqual({ transactions: [], next: null });
    });

    it("is a 404 problem for an unknown block", async () => {
      expect((await get(`/v1/blocks/${"f".repeat(64)}/transactions`)).statusCode).toBe(404);
    });
  });
});
