import { createPrismaClient, sql, type PrismaClient } from "@yabe/db";
import { startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetriesExhaustedError } from "../resilience/retry.ts";
import { RpcConnectionError, RpcError } from "../rpc/errors.ts";
import type { BitcoinNode } from "../rpc/node.ts";
import { startTestNode, type TestNode } from "../testing/bitcoind.ts";
import { checkNode, StartupCheckError } from "./startup.ts";
import { ReorgTooDeepError, runSync, syncOnce, type SyncDeps } from "./sync.ts";
import { InvalidBlockDataError } from "./transform.ts";

describe("sync against regtest", () => {
  let db: TestDatabase;
  let t: TestNode;
  let prisma: PrismaClient;
  let deps: SyncDeps;
  let spendTxid: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    t = await startTestNode();
    prisma = createPrismaClient(db.indexerUrl);
    deps = {
      node: t.node,
      prisma,
      network: "regtest",
      logger: pino({ level: "silent" }),
      maxReorgDepth: 100,
    };
    await t.mine(101);
    spendTxid = await t.send(1.5);
    await t.mine(1);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await t?.stop();
    await db?.stop();
  });

  beforeEach(async () => {
    await prisma.block.deleteMany();
  });

  const tipOf = async () => (await prisma.$queryRawTyped(sql.selectTip()))[0];

  /** Every stored block from `from` to the node's tip has the node's hash, and spent marks balance. */
  async function expectMatchesNode(from: number) {
    const nodeHeight = await t.node.getBlockCount();
    expect((await tipOf())?.height).toBe(nodeHeight);
    for (let height = from; height <= nodeHeight; height += 1) {
      const stored = await prisma.block.findUniqueOrThrow({ where: { height } });
      expect(stored.hash).toBe(await t.node.getBlockHash(height));
    }
    const spent = await prisma.transactionOutput.count({
      where: { spentByTransactionId: { not: null } },
    });
    const spends = await prisma.transactionInput.count({ where: { prevTxid: { not: null } } });
    expect(spent).toBe(spends);
  }

  it("passes the startup checks on an empty database", async () => {
    await expect(checkNode(t.node, prisma, "regtest")).resolves.toBeUndefined();
  });

  it("refuses a node on a different network", async () => {
    await expect(checkNode(t.node, prisma, "signet")).rejects.toThrow(StartupCheckError);
    await expect(checkNode(t.node, prisma, "signet")).rejects.toThrow(/regtest/);
  });

  it("refuses a database holding a different chain", async () => {
    await syncOnce(deps);
    await prisma.block.update({ where: { height: 0 }, data: { hash: "f".repeat(64) } });

    await expect(checkNode(t.node, prisma, "regtest")).rejects.toThrow(/different chain/);
  });

  it("indexes every block from genesis and marks spends", async () => {
    const nodeHeight = await t.node.getBlockCount();

    expect(await syncOnce(deps)).toEqual({
      indexed: nodeHeight + 1,
      rolledBack: 0,
      caughtUp: true,
    });

    await expectMatchesNode(0);
    const spend = await prisma.transaction.findUniqueOrThrow({
      where: { txid: spendTxid },
      include: { inputs: true, block: true },
    });
    const nodeBlock = await t.node.getBlock(spend.block.hash);
    const nodeSpend = nodeBlock.tx.find((tx) => tx.txid === spendTxid);
    expect(spend.feeSat).toBe(BigInt(Math.round(nodeSpend!.fee! * 1e8)));
    const funding = await prisma.transactionOutput.findFirstOrThrow({
      where: {
        transaction: { txid: spend.inputs[0]!.prevTxid! },
        index: spend.inputs[0]!.prevIndex!,
      },
    });
    expect(funding.spentByTransactionId).toBe(spend.id);
  });

  it("a second run indexes only new blocks", async () => {
    await syncOnce(deps);
    await t.mine(2);

    expect(await syncOnce(deps)).toEqual({ indexed: 2, rolledBack: 0, caughtUp: true });
    expect(await syncOnce(deps)).toEqual({ indexed: 0, rolledBack: 0, caughtUp: true });
  });

  it("rolls back to the fork point and follows the longer chain", async () => {
    await syncOnce(deps);
    const reorgSpend = await t.send(0.25);
    const [forkChild] = await t.mine(1);
    await t.mine(1);
    await syncOnce(deps);
    const forkHeight = (await tipOf())!.height - 2;

    await t.invalidate(forkChild!);
    await t.mine(3);

    expect(await syncOnce(deps)).toEqual({ indexed: 3, rolledBack: 2, caughtUp: true });
    await expectMatchesNode(forkHeight);
    const respent = await prisma.transaction.findUniqueOrThrow({
      where: { txid: reorgSpend },
      include: { inputs: true },
    });
    expect(respent.blockHeight).toBe(forkHeight + 1);
    const funding = await prisma.transactionOutput.findFirstOrThrow({
      where: {
        transaction: { txid: respent.inputs[0]!.prevTxid! },
        index: respent.inputs[0]!.prevIndex!,
      },
    });
    expect(funding.spentByTransactionId).toBe(respent.id);
  });

  it("waits when the node is behind our tip on the same chain", async () => {
    await syncOnce(deps);
    const tip = (await tipOf())!;

    await t.invalidate(tip.hash);
    try {
      expect(await syncOnce(deps)).toEqual({ indexed: 0, rolledBack: 0, caughtUp: true });
      expect(await tipOf()).toEqual(tip);
    } finally {
      await t.reconsider(tip.hash);
    }
    expect(await syncOnce(deps)).toEqual({ indexed: 0, rolledBack: 0, caughtUp: true });
  });

  it("treats a shorter chain with a different tip as a reorg", async () => {
    await syncOnce(deps);
    const tip = (await tipOf())!;

    await t.invalidate(await t.node.getBlockHash(tip.height - 1));
    await t.mine(1);

    expect(await syncOnce(deps)).toEqual({ indexed: 1, rolledBack: 2, caughtUp: true });
    await expectMatchesNode(tip.height - 2);
  });

  it("refuses a reorg deeper than MAX_REORG_DEPTH and deletes nothing", async () => {
    await syncOnce(deps);
    const tip = (await tipOf())!;

    await t.invalidate(await t.node.getBlockHash(tip.height - 2));
    await t.mine(4);

    await expect(syncOnce({ ...deps, maxReorgDepth: 2 })).rejects.toBeInstanceOf(ReorgTooDeepError);
    expect(await tipOf()).toEqual(tip);
  });

  it("re-checks the fork when the chain changes mid-pass", async () => {
    let tampered = false;
    const node: BitcoinNode = {
      ...t.node,
      getBlock: async (hash) => {
        const block = await t.node.getBlock(hash);
        if (block.height === 5 && !tampered) {
          tampered = true;
          return { ...block, previousblockhash: "0".repeat(64) };
        }
        return block;
      },
    };

    expect(await syncOnce({ ...deps, node })).toEqual({
      indexed: 5,
      rolledBack: 0,
      caughtUp: false,
    });
    const nodeHeight = await t.node.getBlockCount();
    expect(await syncOnce({ ...deps, node })).toEqual({
      indexed: nodeHeight - 4,
      rolledBack: 0,
      caughtUp: true,
    });
  });

  it("treats a node chain that shrinks mid-pass as a chain change", async () => {
    const nodeHeight = await t.node.getBlockCount();
    const node: BitcoinNode = { ...t.node, getBlockCount: async () => nodeHeight + 3 };

    expect(await syncOnce({ ...deps, node })).toEqual({
      indexed: nodeHeight + 1,
      rolledBack: 0,
      caughtUp: false,
    });
    await expect(t.node.getBlockHash(nodeHeight + 1)).rejects.toBeInstanceOf(RpcError);
  });

  it("stops between blocks when aborted mid-pass, and the next pass resumes", async () => {
    const controller = new AbortController();
    let fetched = 0;
    const node: BitcoinNode = {
      ...t.node,
      getBlock: async (hash) => {
        fetched += 1;
        if (fetched === 3) controller.abort();
        return t.node.getBlock(hash);
      },
    };

    expect(await syncOnce({ ...deps, node }, controller.signal)).toEqual({
      indexed: 3,
      rolledBack: 0,
      caughtUp: false,
    });
    expect((await tipOf())?.height).toBe(2);
    const nodeHeight = await t.node.getBlockCount();
    expect(await syncOnce(deps)).toEqual({
      indexed: nodeHeight - 2,
      rolledBack: 0,
      caughtUp: true,
    });
  });

  it("runSync stops when aborted", async () => {
    const controller = new AbortController();
    const running = runSync({ ...deps, pollIntervalMs: 50 }, controller.signal);
    await t.mine(1);
    const nodeHeight = await t.node.getBlockCount();
    await expect.poll(async () => (await tipOf())?.height, { timeout: 10_000 }).toBe(nodeHeight);

    controller.abort();

    await expect(running).resolves.toBeUndefined();
  });

  const refused = () =>
    new RpcConnectionError("getblockcount", "http://127.0.0.1:1", {
      cause: new Error("ECONNREFUSED"),
    });

  it("runSync retries transient node errors and catches up", async () => {
    let failures = 2;
    const node: BitcoinNode = {
      ...t.node,
      getBlockCount: async () => {
        if (failures > 0) {
          failures -= 1;
          throw refused();
        }
        return t.node.getBlockCount();
      },
    };
    const controller = new AbortController();
    const running = runSync(
      { ...deps, node, pollIntervalMs: 50, backoff: { initialDelayMs: 1, maxDelayMs: 5 } },
      controller.signal,
    );
    const nodeHeight = await t.node.getBlockCount();

    await expect.poll(async () => (await tipOf())?.height, { timeout: 10_000 }).toBe(nodeHeight);
    controller.abort();

    await expect(running).resolves.toBeUndefined();
    expect(failures).toBe(0);
  });

  it("runSync stops on a fatal error", async () => {
    const node: BitcoinNode = {
      ...t.node,
      getBlock: async () => {
        throw new InvalidBlockDataError("no fee");
      },
    };

    await expect(
      runSync({ ...deps, node, pollIntervalMs: 50 }, new AbortController().signal),
    ).rejects.toBeInstanceOf(InvalidBlockDataError);
  });

  it("runSync gives up after 10 retries", async () => {
    let attempts = 0;
    const node: BitcoinNode = {
      ...t.node,
      getBlockCount: async () => {
        attempts += 1;
        throw refused();
      },
    };

    await expect(
      runSync(
        { ...deps, node, pollIntervalMs: 50, backoff: { initialDelayMs: 1, maxDelayMs: 1 } },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(RetriesExhaustedError);
    expect(attempts).toBe(11);
  });

  it("runSync stops promptly when aborted during a backoff wait", async () => {
    let attempts = 0;
    const node: BitcoinNode = {
      ...t.node,
      getBlockCount: async () => {
        attempts += 1;
        throw refused();
      },
    };
    const controller = new AbortController();
    const running = runSync(
      {
        ...deps,
        node,
        pollIntervalMs: 50,
        backoff: { initialDelayMs: 60_000, maxDelayMs: 60_000 },
      },
      controller.signal,
    );
    await expect.poll(() => attempts, { timeout: 5_000 }).toBeGreaterThan(0);
    const started = Date.now();

    controller.abort();

    await expect(running).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
