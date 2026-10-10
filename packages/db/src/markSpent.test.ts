import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient, sql, type PrismaClient } from "./index.ts";
import { blockData, hash, transactionData } from "./testing/fixtures.ts";
import { startTestDatabase, type TestDatabase } from "./testing/database.ts";

const P2WPKH = "witness_v0_keyhash";

describe("sql.markSpent", () => {
  let db: TestDatabase;
  let prisma: PrismaClient;

  beforeAll(async () => {
    db = await startTestDatabase();
    prisma = createPrismaClient(db.indexerUrl);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.stop();
  });

  beforeEach(async () => {
    await prisma.block.deleteMany();
  });

  /**
   * Block 1: coinbase A with outputs 0 and 1.
   * Block 2: B spends A:0; C spends B:0 (a spend within the same block).
   */
  async function seed() {
    await prisma.block.create({ data: blockData(1) });
    const a = await prisma.transaction.create({
      data: {
        ...transactionData(1, 0, hash(0xa)),
        outputs: {
          create: [
            { index: 0, valueSat: 3_000n, scriptType: P2WPKH, scriptHex: "00" },
            { index: 1, valueSat: 2_000n, scriptType: P2WPKH, scriptHex: "00" },
          ],
        },
        inputs: { create: [{ index: 0, sequence: 0n, witness: [], coinbaseHex: "51" }] },
      },
    });
    await prisma.block.create({ data: { ...blockData(2), txCount: 3 } });
    const b = await prisma.transaction.create({
      data: {
        ...transactionData(2, 1, hash(0xb)),
        outputs: { create: [{ index: 0, valueSat: 2_500n, scriptType: P2WPKH, scriptHex: "00" }] },
        inputs: { create: [{ index: 0, prevTxid: hash(0xa), prevIndex: 0, sequence: 0n }] },
      },
    });
    const c = await prisma.transaction.create({
      data: {
        ...transactionData(2, 2, hash(0xc)),
        inputs: { create: [{ index: 0, prevTxid: hash(0xb), prevIndex: 0, sequence: 0n }] },
      },
    });
    return { a, b, c };
  }

  const output = (transactionId: bigint, index: number) =>
    prisma.transactionOutput.findUniqueOrThrow({
      where: { transactionId_index: { transactionId, index } },
    });

  it("marks outputs spent by the block's inputs, including spends within the block", async () => {
    const { a, b, c } = await seed();

    const rows = await prisma.$queryRawTyped(sql.markSpent(2));

    expect(rows).toEqual([{ markedCount: 2 }]);
    expect(await output(a.id, 0)).toMatchObject({
      spentByTransactionId: b.id,
      spentByInputIndex: 0,
    });
    expect(await output(b.id, 0)).toMatchObject({
      spentByTransactionId: c.id,
      spentByInputIndex: 0,
    });
    expect(await output(a.id, 1)).toMatchObject({
      spentByTransactionId: null,
      spentByInputIndex: null,
    });
  });

  it("marks nothing for a block that only has a coinbase", async () => {
    await seed();

    expect(await prisma.$queryRawTyped(sql.markSpent(1))).toEqual([{ markedCount: 0 }]);
  });
});
