import type { ScriptType } from '@yabe/db'

export type Bytes = Uint8Array<ArrayBuffer>

export interface BlockRow {
  height: number
  hash: Bytes
  prevHash: Bytes | null
  merkleRoot: Bytes
  chainwork: Bytes
  version: number
  bits: bigint
  nonce: bigint
  difficulty: number
  time: Date
  medianTime: Date
  size: number
  strippedSize: number
  weight: number
  txCount: number
  subsidySats: bigint
  totalFeeSats: bigint
  totalOutSats: bigint
}

export interface TransactionRow {
  txNum: bigint
  txid: Bytes
  wtxid: Bytes | null
  blockHeight: number
  version: bigint
  locktime: bigint
  size: number
  vsize: number
  weight: number
  inputCount: number
  outputCount: number
  isCoinbase: boolean
  feeSats: bigint | null
}

export interface OutputRow {
  txNum: bigint
  vout: number
  valueSats: bigint
  scriptPubkey: Bytes
  scriptType: ScriptType
  address: string | null
}

export interface InputRow {
  txNum: bigint
  vin: number
  prevTxNum: bigint | null
  prevVout: number | null
  sequence: bigint
  scriptSig: Bytes
  witness: Bytes[]
}

// An input before its previous transaction's txid has been resolved to a tx_num (needs the database).
export interface PendingInputRow extends Omit<InputRow, 'prevTxNum'> {
  prevTxid: string | null
}

export interface BlockData {
  block: BlockRow
  transactions: TransactionRow[]
  outputs: OutputRow[]
  inputs: PendingInputRow[]
}
