import { createPrismaClient, type PrismaClient } from "@yabe/db";
import { hash, startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BlockRows, InputRow, OutputRow, TransactionRows } from "./transform.ts";
import { IntegrityError, writeBlock } from "./writer.ts";

const out = (index: number, valueSat: bigint): OutputRow => ({
  index,
  valueSat,
  scriptType: "witness_v0_keyhash",
  address: `bcrt1q${index}`,
  scriptHex: "0014",
});

const coinbaseIn: InputRow = {
  index: 0,
  prevTxid: null,
  prevIndex: null,
  prevValueSat: null,
  prevAddress: null,
  prevScriptType: null,
  sequence: 0xffffffffn,
  scriptSigHex: null,
  witness: [],
  coinbaseHex: "51",
};

const spendIn = (prevTxid: string, prevIndex: number): InputRow => ({
  ...coinbaseIn,
  prevTxid,
  prevIndex,
  prevValueSat: 1_000n,
  prevAddress: "bcrt1q0",
  prevScriptType: "witness_v0_keyhash",
  coinbaseHex: null,
});

function tx(
  txid: string,
  position: number,
  inputs: InputRow[],
  outputs: OutputRow[],
): TransactionRows {
  return {
    transaction: {
      txid,
      position,
      version: 2,
      locktime: 0n,
      size: 200,
      vsize: 150,
      weight: 600,
      feeSat: position === 0 ? null : 100n,
      isCoinbase: position === 0,
    },
    inputs,
    outputs,
  };
}

function rows(height: number, transactions: TransactionRows[]): BlockRows {
  return {
    block: {
      height,
      hash: hash(1000 + height),
      prevHash: height === 0 ? null : hash(1000 + height - 1),
      merkleRoot: hash(2000 + height),
      version: 0x20000000,
      bits: "207fffff",
      nonce: 0n,
      difficulty: 1,
      time: 1_700_000_000n,
      medianTime: 1_700_000_000n,
      size: 300,
      strippedSize: 200,
      weight: 900,
      txCount: transactions.length,
      subsidySat: 5_000_000_000n,
      totalFeeSat: 0n,
    },
    transactions,
  };
}

describe("writeBlock", () => {
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
    await writeBlock(
      prisma,
      rows(0, [tx(hash(0xa), 0, [coinbaseIn], [out(0, 1_000n), out(1, 2_000n)])]),
    );
  });

  it("writes the block, its transactions, inputs and outputs, and marks spends", async () => {
    await writeBlock(
      prisma,
      rows(1, [
        tx(hash(0xb), 0, [coinbaseIn], [out(0, 5_000n)]),
        tx(hash(0xc), 1, [spendIn(hash(0xa), 0)], [out(0, 900n)]),
        tx(hash(0xd), 2, [spendIn(hash(0xc), 0)], [out(0, 800n)]),
      ]),
    );

    expect(await prisma.block.count()).toBe(2);
    expect(await prisma.transaction.count()).toBe(4);
    const spentA0 = await prisma.transactionOutput.findFirstOrThrow({
      where: { transaction: { txid: hash(0xa) }, index: 0 },
      include: { spentBy: { include: { transaction: true } } },
    });
    expect(spentA0.spentBy?.transaction.txid).toBe(hash(0xc));
    const spentC0 = await prisma.transactionOutput.findFirstOrThrow({
      where: { transaction: { txid: hash(0xc) }, index: 0 },
      include: { spentBy: { include: { transaction: true } } },
    });
    expect(spentC0.spentBy?.transaction.txid).toBe(hash(0xd));
    const unspentA1 = await prisma.transactionOutput.findFirstOrThrow({
      where: { transaction: { txid: hash(0xa) }, index: 1 },
    });
    expect(unspentA1.spentByTransactionId).toBeNull();
  });

  it("rejects a block spending an unknown output and writes nothing from it", async () => {
    const spendsNothing = rows(1, [
      tx(hash(0xb), 0, [coinbaseIn], [out(0, 5_000n)]),
      tx(hash(0xc), 1, [spendIn(hash(0xeeee), 0)], [out(0, 900n)]),
    ]);

    await expect(writeBlock(prisma, spendsNothing)).rejects.toBeInstanceOf(IntegrityError);
    expect(await prisma.block.count()).toBe(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("rejects a height that is already stored and leaves it unchanged", async () => {
    const duplicate = rows(0, [tx(hash(0xf), 0, [coinbaseIn], [out(0, 1n)])]);

    await expect(writeBlock(prisma, duplicate)).rejects.toThrow();
    expect(await prisma.transaction.findMany({ select: { txid: true } })).toEqual([
      { txid: hash(0xa) },
    ]);
  });
});
