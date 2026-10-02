import { z } from 'zod'
import { DateTime, HashHex, Sats, ScriptTypeSchema } from '../../schemas/common.js'

const Prevout = z.object({
  txid: HashHex,
  vout: z.int(),
  value: Sats,
  address: z.string().nullable(),
  scriptType: ScriptTypeSchema,
})

const InputView = z.object({
  vin: z.int(),
  coinbase: z.boolean(),
  prevout: Prevout.nullable(),
  scriptSig: z.object({
    hex: z.string(),
    asm: z.string().nullable().describe('Null for coinbase data or undecodable scripts'),
  }),
  witness: z.array(z.string()),
  sequence: z.int(),
})

const OutputView = z.object({
  vout: z.int(),
  value: Sats,
  scriptPubKey: z.object({
    hex: z.string(),
    asm: z.string().nullable(),
    type: ScriptTypeSchema,
    address: z.string().nullable(),
  }),
  spentBy: z.object({ txid: HashHex, vin: z.int() }).nullable(),
})

export const TxDetail = z.object({
  txid: HashHex,
  wtxid: HashHex,
  version: z.int(),
  locktime: z.int(),
  size: z.int(),
  vsize: z.int(),
  weight: z.int(),
  isCoinbase: z.boolean(),
  fee: Sats.nullable(),
  feeRate: z.number().nullable().describe('sat/vB, 2 decimals'),
  totalIn: Sats.nullable(),
  totalOut: Sats,
  confirmations: z.int().min(0),
  block: z.object({ height: z.int(), hash: HashHex, time: DateTime }),
  inputs: z.array(InputView),
  outputs: z.array(OutputView),
})
export type TxDetail = z.infer<typeof TxDetail>
