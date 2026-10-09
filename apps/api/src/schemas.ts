import { z } from "zod";

/** Heights and positions are stored as int4. */
export const INT4_MAX = 2_147_483_647;

/** A 64-hex hash or txid in any case; normalised to lowercase. */
export const hashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters")
  .transform((value) => value.toLowerCase());

/** A block height as digits, within the stored int4 range. */
export const heightSchema = z
  .string()
  .regex(/^\d{1,10}$/, "must be a non-negative integer")
  .transform(Number)
  .refine((value) => value <= INT4_MAX, `must be at most ${INT4_MAX}`);

/** A block height or a block hash. */
export const blockIdSchema = z
  .string()
  .refine(
    (value) => /^\d{1,10}$/.test(value) || /^[0-9a-fA-F]{64}$/.test(value),
    "must be a block height or a 64-hex block hash",
  )
  .refine(
    (value) => !/^\d+$/.test(value) || Number(value) <= INT4_MAX,
    `height must be at most ${INT4_MAX}`,
  )
  .transform((value) =>
    /^\d+$/.test(value) ? { height: Number(value) } : { hash: value.toLowerCase() },
  );

export const limitSchema = (fallback: number) =>
  z.coerce.number().int().min(1).max(100).default(fallback);

export const blockSummarySchema = z
  .object({
    height: z.number().int(),
    hash: z.string(),
    time: z.number().int(),
    txCount: z.number().int(),
    size: z.number().int(),
    weight: z.number().int(),
    totalFeeSat: z.number().int(),
  })
  .meta({ id: "BlockSummary" });

export const blockSchema = z
  .object({
    height: z.number().int(),
    hash: z.string(),
    prevHash: z.string().nullable(),
    nextBlockHash: z.string().nullable(),
    confirmations: z.number().int(),
    merkleRoot: z.string(),
    version: z.number().int(),
    bits: z.string(),
    nonce: z.number().int(),
    difficulty: z.number(),
    time: z.number().int(),
    medianTime: z.number().int(),
    size: z.number().int(),
    strippedSize: z.number().int(),
    weight: z.number().int(),
    txCount: z.number().int(),
    subsidySat: z.number().int(),
    totalFeeSat: z.number().int(),
    rewardSat: z.number().int(),
  })
  .meta({ id: "Block" });

export const transactionSummarySchema = z
  .object({
    txid: z.string(),
    position: z.number().int(),
    isCoinbase: z.boolean(),
    feeSat: z.number().int().nullable(),
    vsize: z.number().int(),
    inputCount: z.number().int(),
    outputCount: z.number().int(),
    totalInSat: z.number().int().nullable(),
    totalOutSat: z.number().int(),
  })
  .meta({ id: "TransactionSummary" });

export const toNumber = (value: bigint | number | null): number | null =>
  value === null ? null : Number(value);

const scriptSchema = z.object({ hex: z.string(), asm: z.string() }).meta({ id: "Script" });

export const transactionSchema = z
  .object({
    txid: z.string(),
    blockHash: z.string(),
    blockHeight: z.number().int(),
    blockTime: z.number().int(),
    position: z.number().int(),
    confirmations: z.number().int(),
    version: z.number().int(),
    locktime: z.number().int(),
    size: z.number().int(),
    vsize: z.number().int(),
    weight: z.number().int(),
    isCoinbase: z.boolean(),
    feeSat: z.number().int().nullable(),
    feeRate: z.number().nullable().describe("sat/vB"),
    inputs: z.array(
      z.object({
        index: z.number().int(),
        coinbaseHex: z.string().nullable(),
        prevTxid: z.string().nullable(),
        prevIndex: z.number().int().nullable(),
        valueSat: z.number().int().nullable(),
        address: z.string().nullable(),
        scriptType: z.string().nullable(),
        scriptSig: scriptSchema.nullable(),
        witness: z.array(z.string()),
        sequence: z.number().int(),
      }),
    ),
    outputs: z.array(
      z.object({
        index: z.number().int(),
        valueSat: z.number().int(),
        address: z.string().nullable(),
        scriptType: z.string(),
        script: scriptSchema,
        spentBy: z.object({ txid: z.string(), inputIndex: z.number().int() }).nullable(),
      }),
    ),
  })
  .meta({ id: "Transaction" });

export const searchResultSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("block"), hash: z.string(), height: z.number().int() }),
    z.object({ type: z.literal("transaction"), txid: z.string() }),
  ])
  .meta({ id: "SearchResult" });
