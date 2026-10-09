import { z } from "zod";

const hex = z.string().regex(/^[0-9a-f]*$/);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const uint = z.number().int().nonnegative();

export const blockchainInfoSchema = z.object({ chain: z.string(), blocks: uint });
export const blockHashSchema = hash;
export const blockCountSchema = uint;

const scriptPubKeySchema = z.object({
  hex,
  type: z.string(),
  address: z.string().optional(),
});

const inputSchema = z.object({
  coinbase: hex.optional(),
  txid: hash.optional(),
  vout: uint.optional(),
  scriptSig: z.object({ hex }).optional(),
  txinwitness: z.array(hex).optional(),
  prevout: z.object({ value: z.number(), scriptPubKey: scriptPubKeySchema }).optional(),
  sequence: uint,
});

const outputSchema = z.object({
  value: z.number(),
  n: uint,
  scriptPubKey: scriptPubKeySchema,
});

const transactionSchema = z.object({
  txid: hash,
  version: z.number().int(),
  size: uint,
  vsize: uint,
  weight: uint,
  locktime: uint,
  vin: z.array(inputSchema).min(1),
  vout: z.array(outputSchema).min(1),
  fee: z.number().optional(),
});

/** `getblock <hash> 3`: the block with every transaction and each input's prevout. */
export const blockSchema = z.object({
  hash,
  height: uint,
  version: z.number().int(),
  merkleroot: hash,
  time: uint,
  mediantime: uint,
  nonce: uint,
  bits: z.string().regex(/^[0-9a-f]{8}$/),
  difficulty: z.number(),
  nTx: uint,
  previousblockhash: hash.optional(),
  strippedsize: uint,
  size: uint,
  weight: uint,
  tx: z.array(transactionSchema).min(1),
});

export type RpcBlock = z.infer<typeof blockSchema>;
export type RpcTransaction = RpcBlock["tx"][number];
