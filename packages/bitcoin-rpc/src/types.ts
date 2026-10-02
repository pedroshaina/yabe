// Shapes returned by Bitcoin Core (v23+) for the RPCs YABE uses. Amounts are BTC floats.

export interface RpcScriptPubKey {
  asm: string
  desc?: string
  hex: string
  address?: string
  type: string
}

export interface RpcPrevout {
  generated: boolean
  height: number
  value: number
  scriptPubKey: RpcScriptPubKey
}

export interface RpcVin {
  coinbase?: string
  txid?: string
  vout?: number
  scriptSig?: { asm: string; hex: string }
  txinwitness?: string[]
  prevout?: RpcPrevout
  sequence: number
}

export interface RpcVout {
  value: number
  n: number
  scriptPubKey: RpcScriptPubKey
}

export interface RpcTx {
  txid: string
  hash: string
  version: number
  size: number
  vsize: number
  weight: number
  locktime: number
  vin: RpcVin[]
  vout: RpcVout[]
  fee?: number
  hex: string
}

export interface RpcBlock {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash?: string
  nextblockhash?: string
  strippedsize: number
  size: number
  weight: number
  tx: RpcTx[]
}

export interface RpcBlockchainInfo {
  chain: string
  blocks: number
  headers: number
  bestblockhash: string
  pruned: boolean
  initialblockdownload: boolean
  verificationprogress: number
}
