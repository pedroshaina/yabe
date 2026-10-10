import { sql, type PrismaClient } from "@yabe/db";
import { blockData, hash, transactionData } from "@yabe/db/testing";

export const P2WPKH_HEX = `0014${"11".repeat(20)}`;
export const NULLDATA_HEX = `6a0b${"ab".repeat(11)}`;
/** DER signature with SIGHASH_ALL, then a compressed pubkey: Core asm `<sig>[ALL] <pubkey>`. */
export const SIG_HEX = `30440220${"11"}${"22".repeat(31)}0220${"33".repeat(32)}`;
export const PUBKEY_HEX = `02${"11".repeat(32)}`;
export const SCRIPT_SIG_HEX = `47${SIG_HEX}01` + `21${PUBKEY_HEX}`;

export interface SeededChain {
  blocks: { height: number; hash: string }[];
  txids: { a: string; b: string; c: string; d: string; e: string };
}

const out = (index: number, valueSat: bigint, address: string | null, scriptHex = P2WPKH_HEX) => ({
  index,
  valueSat,
  scriptType: scriptHex === NULLDATA_HEX ? "nulldata" : "witness_v0_keyhash",
  address,
  scriptHex,
});
const coinbaseInput = {
  index: 0,
  sequence: 0xffffffffn,
  witness: [`${"00".repeat(32)}`],
  coinbaseHex: "016600",
};

/** Blocks 0–2: A (coinbase) → C spends A:0 in block 1 → E spends C:0 in block 2. */
export async function seedChain(prisma: PrismaClient): Promise<SeededChain> {
  const txids = { a: hash(0xa), b: hash(0xb), c: hash(0xc), d: hash(0xd), e: hash(0xe) };

  await prisma.block.create({ data: { ...blockData(0), txCount: 1 } });
  await prisma.transaction.create({
    data: {
      ...transactionData(0, 0, txids.a),
      outputs: { create: [out(0, 5_000_000_000n, "bcrt1qa0"), out(1, 0n, null, NULLDATA_HEX)] },
      inputs: { create: [coinbaseInput] },
    },
  });

  await prisma.block.create({ data: { ...blockData(1), txCount: 2, totalFeeSat: 100_000n } });
  await prisma.transaction.create({
    data: {
      ...transactionData(1, 0, txids.b),
      outputs: { create: [out(0, 5_000_100_000n, "bcrt1qb0")] },
      inputs: { create: [coinbaseInput] },
    },
  });
  await prisma.transaction.create({
    data: {
      ...transactionData(1, 1, txids.c),
      feeSat: 100_000n,
      outputs: {
        create: [out(0, 1_000_000_000n, "bcrt1qc0"), out(1, 3_999_900_000n, "bcrt1qc1")],
      },
      inputs: {
        create: [
          {
            index: 0,
            prevTxid: txids.a,
            prevIndex: 0,
            prevValueSat: 5_000_000_000n,
            prevAddress: "bcrt1qa0",
            prevScriptType: "witness_v0_keyhash",
            sequence: 0xfffffffdn,
            witness: ["3044", "02fe"],
          },
        ],
      },
    },
  });
  await prisma.$queryRawTyped(sql.markSpent(1));

  await prisma.block.create({ data: { ...blockData(2), txCount: 2, totalFeeSat: 10_000n } });
  await prisma.transaction.create({
    data: {
      ...transactionData(2, 0, txids.d),
      outputs: { create: [out(0, 5_000_010_000n, "bcrt1qd0")] },
      inputs: { create: [coinbaseInput] },
    },
  });
  await prisma.transaction.create({
    data: {
      ...transactionData(2, 1, txids.e),
      feeSat: 10_000n,
      vsize: 150,
      outputs: { create: [out(0, 999_990_000n, "bcrt1qe0")] },
      inputs: {
        create: [
          {
            index: 0,
            prevTxid: txids.c,
            prevIndex: 0,
            prevValueSat: 1_000_000_000n,
            prevAddress: "bcrt1qc0",
            prevScriptType: "witness_v0_keyhash",
            sequence: 0xffffffffn,
            scriptSigHex: SCRIPT_SIG_HEX,
            witness: [],
          },
        ],
      },
    },
  });
  await prisma.$queryRawTyped(sql.markSpent(2));

  return { blocks: [0, 1, 2].map((height) => ({ height, hash: blockData(height).hash })), txids };
}
