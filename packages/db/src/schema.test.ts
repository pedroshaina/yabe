import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient, sql, type PrismaClient } from "./index.ts";
import { runPrisma, startTestDatabase, type TestDatabase } from "./testing/database.ts";

const hash = (n: number): string => n.toString(16).padStart(64, "0");

function blockData(height: number) {
  return {
    height,
    hash: hash(1000 + height),
    prevHash: height === 0 ? null : hash(1000 + height - 1),
    merkleRoot: hash(2000 + height),
    version: 0x20000000,
    bits: "1d00ffff",
    nonce: 0n,
    difficulty: 1,
    time: 1_700_000_000n + BigInt(height) * 600n,
    medianTime: 1_700_000_000n + BigInt(height) * 600n,
    size: 285,
    strippedSize: 249,
    weight: 1032,
    txCount: 1,
    subsidySat: 5_000_000_000n,
    totalFeeSat: 0n,
  };
}

function transactionData(blockHeight: number, position: number, txid: string) {
  return {
    txid,
    blockHeight,
    position,
    version: 2,
    locktime: 0n,
    size: 200,
    vsize: 150,
    weight: 600,
    feeSat: position === 0 ? null : 1_000n,
    isCoinbase: position === 0,
  };
}

/** Block 1 has a coinbase paying output 0; block 2 has a tx spending it. */
async function seedChain(prisma: PrismaClient) {
  await prisma.block.create({ data: blockData(1) });
  const coinbase = await prisma.transaction.create({
    data: {
      ...transactionData(1, 0, hash(1)),
      outputs: {
        create: [
          {
            index: 0,
            valueSat: 5_000_000_000n,
            scriptType: "witness_v0_keyhash",
            scriptHex: "0014" + "ab".repeat(20),
          },
        ],
      },
      inputs: { create: [{ index: 0, sequence: 0xffffffffn, witness: [], coinbaseHex: "51" }] },
    },
  });

  await prisma.block.create({ data: { ...blockData(2), txCount: 2 } });
  const spender = await prisma.transaction.create({
    data: {
      ...transactionData(2, 1, hash(2)),
      inputs: {
        create: [
          {
            index: 0,
            prevTxid: hash(1),
            prevIndex: 0,
            prevValueSat: 5_000_000_000n,
            prevScriptType: "witness_v0_keyhash",
            sequence: 0xfffffffdn,
            witness: ["30" + "00".repeat(70), "02" + "11".repeat(32)],
          },
        ],
      },
    },
  });

  await prisma.transactionOutput.update({
    where: { transactionId_index: { transactionId: coinbase.id, index: 0 } },
    data: { spentByTransactionId: spender.id, spentByInputIndex: 0 },
  });

  return { coinbase, spender };
}

describe("schema", () => {
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

  it("re-running migrations is a no-op", async () => {
    const { stdout } = await runPrisma(["migrate", "deploy"], db.indexerUrl);
    expect(stdout).toMatch(/No pending migrations to apply/);
  });

  it("deleting a block cascades to its transactions, inputs and outputs", async () => {
    await seedChain(prisma);

    await prisma.block.deleteMany({ where: { height: { gte: 1 } } });

    expect(await prisma.transaction.count()).toBe(0);
    expect(await prisma.transactionInput.count()).toBe(0);
    expect(await prisma.transactionOutput.count()).toBe(0);
  });

  it("deleting the spending block clears the spent mark on the earlier output", async () => {
    const { coinbase } = await seedChain(prisma);

    await prisma.block.deleteMany({ where: { height: { gt: 1 } } });

    const output = await prisma.transactionOutput.findUniqueOrThrow({
      where: { transactionId_index: { transactionId: coinbase.id, index: 0 } },
    });
    expect(output.spentByTransactionId).toBeNull();
    expect(output.spentByInputIndex).toBeNull();
  });

  it("rejects a spent mark with only one of its two columns set", async () => {
    const { coinbase } = await seedChain(prisma);
    const where = { transactionId_index: { transactionId: coinbase.id, index: 0 } };

    // A half mark would bypass the foreign key and never be cleared by a rollback.
    await expect(
      prisma.transactionOutput.update({ where, data: { spentByInputIndex: null } }),
    ).rejects.toThrow(/check constraint/i);
    await expect(
      prisma.transactionOutput.update({
        where,
        data: { spentByTransactionId: null, spentByInputIndex: 0 },
      }),
    ).rejects.toThrow(/check constraint/i);
  });

  it("rejects a duplicate txid", async () => {
    await prisma.block.create({ data: blockData(1) });
    await prisma.transaction.create({ data: transactionData(1, 0, hash(1)) });

    await expect(
      prisma.transaction.create({ data: transactionData(1, 1, hash(1)) }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("rejects two transactions at the same position in a block", async () => {
    await prisma.block.create({ data: blockData(1) });
    await prisma.transaction.create({ data: transactionData(1, 0, hash(1)) });

    await expect(
      prisma.transaction.create({ data: transactionData(1, 0, hash(2)) }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("selectTip returns nothing for an empty database and the highest block otherwise", async () => {
    expect(await prisma.$queryRawTyped(sql.selectTip())).toEqual([]);

    await prisma.block.createMany({ data: [blockData(0), blockData(1), blockData(2)] });

    expect(await prisma.$queryRawTyped(sql.selectTip())).toEqual([
      { height: 2, hash: hash(1002), time: 1_700_001_200n },
    ]);
  });

  it("lets yabe_api read the migrated tables but not write them", async () => {
    await seedChain(prisma);
    const api = new pg.Client({ connectionString: db.apiUrl });
    await api.connect();
    try {
      for (const table of ["block", "transaction", "transaction_input", "transaction_output"]) {
        const { rows } = await api.query<{ count: string }>(`SELECT count(*) FROM "${table}"`);
        expect(Number(rows[0]?.count)).toBeGreaterThan(0);
      }
      await expect(api.query(`DELETE FROM "block"`)).rejects.toThrow(/permission denied/);
    } finally {
      await api.end();
    }
  });

  it("does not let yabe_api run migrations", async () => {
    // On the migrated database there is nothing pending, so use a fresh, unmigrated one.
    const fresh = await startTestDatabase({ migrate: false });
    try {
      await expect(runPrisma(["migrate", "deploy"], fresh.apiUrl)).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await fresh.stop();
    }
  });
});
