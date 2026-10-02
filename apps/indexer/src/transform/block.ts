import type { RpcBlock, RpcTx } from '@yabe/bitcoin-rpc'
import { MAX_TX_POSITION, toTxNum } from '@yabe/db'
import { btcToSats, hexToBytes, type Network } from '@yabe/shared'
import { toScriptType } from './script-type.js'
import { subsidyFor } from './subsidy.js'
import type { BlockData, OutputRow, PendingInputRow, TransactionRow } from './types.js'

export class MissingFeeError extends Error {
  override name = 'MissingFeeError'
}
export class InvalidBlockError extends Error {
  override name = 'InvalidBlockError'
}

// Pure mapping from `getblock <hash> 3` output to database rows. No I/O.
export const transformBlock = (rpc: RpcBlock, network: Network): BlockData => {
  if (rpc.tx.length === 0 || rpc.tx.length > MAX_TX_POSITION + 1) {
    throw new InvalidBlockError(`Block ${rpc.height} has ${rpc.tx.length} transactions`)
  }

  const transactions: TransactionRow[] = []
  const outputs: OutputRow[] = []
  const inputs: PendingInputRow[] = []
  let totalFeeSats = 0n
  let totalOutSats = 0n

  rpc.tx.forEach((tx: RpcTx, position) => {
    const txNum = toTxNum(rpc.height, position)
    const isCoinbase = tx.vin[0]?.coinbase !== undefined
    if (isCoinbase !== (position === 0)) {
      throw new InvalidBlockError(
        `Block ${rpc.height}: coinbase must be exactly the first transaction (tx ${tx.txid})`,
      )
    }
    if (!isCoinbase && tx.fee === undefined) {
      throw new MissingFeeError(
        `Block ${rpc.height}: tx ${tx.txid} has no fee; the node must be non-pruned with undo data (getblock verbosity 3)`,
      )
    }
    const feeSats = tx.fee === undefined ? null : btcToSats(tx.fee)
    if (feeSats !== null) totalFeeSats += feeSats

    transactions.push({
      txNum,
      txid: hexToBytes(tx.txid),
      wtxid: tx.hash === tx.txid ? null : hexToBytes(tx.hash),
      blockHeight: rpc.height,
      version: BigInt(tx.version),
      locktime: BigInt(tx.locktime),
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      inputCount: tx.vin.length,
      outputCount: tx.vout.length,
      isCoinbase,
      feeSats,
    })

    for (const out of tx.vout) {
      const valueSats = btcToSats(out.value)
      if (!isCoinbase) totalOutSats += valueSats
      outputs.push({
        txNum,
        vout: out.n,
        valueSats,
        scriptPubkey: hexToBytes(out.scriptPubKey.hex),
        scriptType: toScriptType(out.scriptPubKey.type),
        address: out.scriptPubKey.address ?? null,
      })
    }

    tx.vin.forEach((input, vin) => {
      inputs.push({
        txNum,
        vin,
        prevTxid: input.txid ?? null,
        prevVout: input.vout ?? null,
        sequence: BigInt(input.sequence),
        scriptSig: hexToBytes(input.coinbase ?? input.scriptSig?.hex ?? ''),
        witness: (input.txinwitness ?? []).map(hexToBytes),
      })
    })
  })

  return {
    block: {
      height: rpc.height,
      hash: hexToBytes(rpc.hash),
      prevHash: rpc.previousblockhash ? hexToBytes(rpc.previousblockhash) : null,
      merkleRoot: hexToBytes(rpc.merkleroot),
      chainwork: hexToBytes(rpc.chainwork),
      version: rpc.version,
      bits: BigInt(Number.parseInt(rpc.bits, 16)),
      nonce: BigInt(rpc.nonce),
      difficulty: rpc.difficulty,
      time: new Date(rpc.time * 1000),
      medianTime: new Date(rpc.mediantime * 1000),
      size: rpc.size,
      strippedSize: rpc.strippedsize,
      weight: rpc.weight,
      txCount: rpc.nTx,
      subsidySats: subsidyFor(rpc.height, network),
      totalFeeSats,
      // Sum of non-coinbase outputs — matches `getblockstats.total_out`.
      totalOutSats,
    },
    transactions,
    outputs,
    inputs,
  }
}
