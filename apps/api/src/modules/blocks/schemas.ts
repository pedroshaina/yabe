import { z } from 'zod'
import { DateTime, HashHex, Sats } from '../../schemas/common.js'

export const BlockSummary = z.object({
  height: z.int().min(0),
  hash: HashHex,
  time: DateTime,
  txCount: z.int(),
  size: z.int(),
  weight: z.int(),
  totalFee: Sats,
  subsidy: Sats,
})
export type BlockSummary = z.infer<typeof BlockSummary>

export const BlockDetail = BlockSummary.extend({
  confirmations: z.int().min(0),
  prevHash: HashHex.nullable(),
  nextHash: HashHex.nullable(),
  merkleRoot: HashHex,
  version: z.int(),
  bits: z.string().describe('Compact target, 8 hex chars'),
  nonce: z.int(),
  difficulty: z.number(),
  medianTime: DateTime,
  strippedSize: z.int(),
  chainwork: z.string().describe('Hex'),
  totalOut: Sats,
})
export type BlockDetail = z.infer<typeof BlockDetail>

export const TxSummary = z.object({
  txid: HashHex,
  position: z.int().min(0),
  isCoinbase: z.boolean(),
  inputCount: z.int(),
  outputCount: z.int(),
  totalOut: Sats,
  fee: Sats.nullable(),
  vsize: z.int(),
})
export type TxSummary = z.infer<typeof TxSummary>
