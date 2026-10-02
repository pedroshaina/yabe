import { Type, type Static } from 'typebox'
import { DateTime, HashHex, Nullable, Sats, ScriptTypeSchema } from '../../schemas/common.js'

const Prevout = Type.Object({
  txid: HashHex,
  vout: Type.Integer(),
  value: Sats,
  address: Nullable(Type.String()),
  scriptType: ScriptTypeSchema,
})

const InputView = Type.Object({
  vin: Type.Integer(),
  coinbase: Type.Boolean(),
  prevout: Nullable(Prevout),
  scriptSig: Type.Object({
    hex: Type.String(),
    asm: Nullable(Type.String({ description: 'Null for coinbase data or undecodable scripts' })),
  }),
  witness: Type.Array(Type.String()),
  sequence: Type.Integer(),
})

const OutputView = Type.Object({
  vout: Type.Integer(),
  value: Sats,
  scriptPubKey: Type.Object({
    hex: Type.String(),
    asm: Nullable(Type.String()),
    type: ScriptTypeSchema,
    address: Nullable(Type.String()),
  }),
  spentBy: Nullable(Type.Object({ txid: HashHex, vin: Type.Integer() })),
})

export const TxDetail = Type.Object({
  txid: HashHex,
  wtxid: HashHex,
  version: Type.Integer(),
  locktime: Type.Integer(),
  size: Type.Integer(),
  vsize: Type.Integer(),
  weight: Type.Integer(),
  isCoinbase: Type.Boolean(),
  fee: Nullable(Sats),
  feeRate: Nullable(Type.Number({ description: 'sat/vB, 2 decimals' })),
  totalIn: Nullable(Sats),
  totalOut: Sats,
  confirmations: Type.Integer({ minimum: 0 }),
  block: Type.Object({ height: Type.Integer(), hash: HashHex, time: DateTime }),
  inputs: Type.Array(InputView),
  outputs: Type.Array(OutputView),
})
export type TxDetail = Static<typeof TxDetail>
