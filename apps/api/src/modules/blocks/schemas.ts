import { Type, type Static } from 'typebox'
import { DateTime, HashHex, Nullable, Sats } from '../../schemas/common.js'

const blockSummaryProps = {
  height: Type.Integer({ minimum: 0 }),
  hash: HashHex,
  time: DateTime,
  txCount: Type.Integer(),
  size: Type.Integer(),
  weight: Type.Integer(),
  totalFee: Sats,
  subsidy: Sats,
}

export const BlockSummary = Type.Object(blockSummaryProps)
export type BlockSummary = Static<typeof BlockSummary>

export const BlockDetail = Type.Object({
  ...blockSummaryProps,
  confirmations: Type.Integer({ minimum: 0 }),
  prevHash: Nullable(HashHex),
  nextHash: Nullable(HashHex),
  merkleRoot: HashHex,
  version: Type.Integer(),
  bits: Type.String({ description: 'Compact target, 8 hex chars' }),
  nonce: Type.Integer(),
  difficulty: Type.Number(),
  medianTime: DateTime,
  strippedSize: Type.Integer(),
  chainwork: Type.String({ description: 'Hex' }),
  totalOut: Sats,
})
export type BlockDetail = Static<typeof BlockDetail>

export const TxSummary = Type.Object({
  txid: HashHex,
  position: Type.Integer({ minimum: 0 }),
  isCoinbase: Type.Boolean(),
  inputCount: Type.Integer(),
  outputCount: Type.Integer(),
  totalOut: Sats,
  fee: Nullable(Sats),
  vsize: Type.Integer(),
})
export type TxSummary = Static<typeof TxSummary>
