import { createPrismaClient, sql, type PrismaClient } from "@yabe/db";
import { startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestNode, type TestNode } from "../testing/bitcoind.ts";
import { checkNode, StartupCheckError } from "./startup.ts";
import { ChainMismatchError, runSync, syncOnce, type SyncDeps } from "./sync.ts";

describe("sync against regtest", () => {
  let db: TestDatabase;
  let t: TestNode;
  let prisma: PrismaClient;
  let deps: SyncDeps;
  let spendTxid: string;

  beforeAll(async () => {
    [db, t] = await Promise.all([startTestDatabase(), startTestNode()]);
    prisma = createPrismaClient(db.indexerUrl);
    deps = { node: t.node, prisma, network: "regtest", logger: pino({ level: "silent" }) };
    await t.mine(101);
    spendTxid = await t.send(1.5);
    await t.mine(1);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await Promise.all([db?.stop(), t?.stop()]);
  });

  it("passes the startup checks on an empty database", async () => {
    await expect(checkNode(t.node, prisma, "regtest")).resolves.toBeUndefined();
  });

  it("refuses a node on a different network", async () => {
    await expect(checkNode(t.node, prisma, "signet")).rejects.toThrow(StartupCheckError);
    await expect(checkNode(t.node, prisma, "signet")).rejects.toThrow(/regtest/);
  });

  it("indexes every block from genesis and marks spends", async () => {
    expect(await syncOnce(deps)).toBe(103);

    const [tip] = await prisma.$queryRawTyped(sql.selectTip());
    expect(tip?.height).toBe(102);
    expect(tip?.hash).toBe(await t.node.getBlockHash(102));

    const nodeBlock = await t.node.getBlock(await t.node.getBlockHash(102));
    const nodeSpend = nodeBlock.tx.find((tx) => tx.txid === spendTxid);
    const spend = await prisma.transaction.findUniqueOrThrow({
      where: { txid: spendTxid },
      include: { inputs: true },
    });
    expect(spend.feeSat).toBe(BigInt(Math.round(nodeSpend!.fee! * 1e8)));
    const funding = await prisma.transactionOutput.findFirstOrThrow({
      where: {
        transaction: { txid: spend.inputs[0]!.prevTxid! },
        index: spend.inputs[0]!.prevIndex!,
      },
    });
    expect(funding.spentByTransactionId).toBe(spend.id);
    const stored = await prisma.block.findUniqueOrThrow({ where: { height: 102 } });
    expect(stored.totalFeeSat).toBe(spend.feeSat);
  });

  it("a second run indexes only new blocks", async () => {
    await t.mine(2);

    expect(await syncOnce(deps)).toBe(2);
    expect(await syncOnce(deps)).toBe(0);
  });

  it("refuses a database holding a different chain", async () => {
    const genesis = await prisma.block.findUniqueOrThrow({ where: { height: 0 } });
    await prisma.block.update({ where: { height: 0 }, data: { hash: "f".repeat(64) } });
    try {
      await expect(checkNode(t.node, prisma, "regtest")).rejects.toThrow(/different chain/);
    } finally {
      await prisma.block.update({ where: { height: 0 }, data: { hash: genesis.hash } });
    }
  });

  it("stops at a block that does not build on our tip", async () => {
    const [tip] = await prisma.$queryRawTyped(sql.selectTip());
    await prisma.block.update({ where: { height: tip!.height }, data: { hash: "e".repeat(64) } });
    try {
      await t.mine(1);
      await expect(syncOnce(deps)).rejects.toBeInstanceOf(ChainMismatchError);
    } finally {
      await prisma.block.update({ where: { height: tip!.height }, data: { hash: tip!.hash } });
    }
    expect(await syncOnce(deps)).toBe(1);
  });

  it("runSync stops when aborted", async () => {
    const controller = new AbortController();
    const running = runSync({ ...deps, pollIntervalMs: 50 }, controller.signal);
    await t.mine(1);
    await expect
      .poll(async () => (await prisma.$queryRawTyped(sql.selectTip()))[0]?.height, {
        timeout: 10_000,
      })
      .toBe(await t.node.getBlockCount());

    controller.abort();

    await expect(running).resolves.toBeUndefined();
  });
});
