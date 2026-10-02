import { bytesToHex, hexToBytes } from '@yabe/shared'
import { notFound } from '../../errors.js'
import { scriptToAsm } from '../../lib/script.js'
import { confirmations } from '../chain.js'
import type { TransactionsRepository } from './repository.js'
import type { TxDetail } from './schemas.js'

const outpointKey = (txNum: bigint, vout: number) => `${txNum}:${vout}`

export const createTransactionsService = (repo: TransactionsRepository) => ({
  async getByTxid(txidHex: string): Promise<TxDetail> {
    const tx = await repo.findByTxid(hexToBytes(txidHex.toLowerCase()))
    if (!tx) throw notFound(`Transaction ${txidHex} not found`)

    const refs = tx.inputs.flatMap((i) =>
      i.prevTxNum === null || i.prevVout === null ? [] : [{ txNum: i.prevTxNum, vout: i.prevVout }],
    )
    const [tip, prevOutputs, spenders] = await Promise.all([
      repo.tipHeight(),
      repo.findOutputs(refs),
      repo.findSpenders(tx.txNum),
    ])
    const prevByOutpoint = new Map(prevOutputs.map((o) => [outpointKey(o.txNum, o.vout), o]))
    const spenderByVout = new Map(spenders.map((s) => [s.prevVout, s]))

    const inputs = tx.inputs.map((input) => {
      const prev =
        input.prevTxNum === null || input.prevVout === null
          ? undefined
          : prevByOutpoint.get(outpointKey(input.prevTxNum, input.prevVout))
      return {
        vin: input.vin,
        coinbase: tx.isCoinbase,
        prevout: prev
          ? {
              txid: bytesToHex(prev.transaction.txid),
              vout: prev.vout,
              value: Number(prev.valueSats),
              address: prev.address,
              scriptType: prev.scriptType,
            }
          : null,
        scriptSig: {
          hex: bytesToHex(input.scriptSig),
          asm: tx.isCoinbase ? null : scriptToAsm(input.scriptSig),
        },
        witness: input.witness.map(bytesToHex),
        sequence: Number(input.sequence),
      }
    })

    const outputs = tx.outputs.map((output) => {
      const spender = spenderByVout.get(output.vout)
      return {
        vout: output.vout,
        value: Number(output.valueSats),
        scriptPubKey: {
          hex: bytesToHex(output.scriptPubkey),
          asm: scriptToAsm(output.scriptPubkey),
          type: output.scriptType,
          address: output.address,
        },
        spentBy: spender ? { txid: bytesToHex(spender.transaction.txid), vin: spender.vin } : null,
      }
    })

    const totalOut = outputs.reduce((sum, o) => sum + o.value, 0)
    const totalIn =
      tx.isCoinbase || inputs.some((i) => i.prevout === null)
        ? null
        : inputs.reduce((sum, i) => sum + (i.prevout?.value ?? 0), 0)
    const fee = tx.feeSats === null ? null : Number(tx.feeSats)
    const txid = bytesToHex(tx.txid)

    return {
      txid,
      wtxid: tx.wtxid ? bytesToHex(tx.wtxid) : txid,
      version: Number(tx.version),
      locktime: Number(tx.locktime),
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      isCoinbase: tx.isCoinbase,
      fee,
      feeRate: fee === null ? null : Math.round((fee / tx.vsize) * 100) / 100,
      totalIn,
      totalOut,
      confirmations: confirmations(tx.block.height, tip),
      block: { height: tx.block.height, hash: bytesToHex(tx.block.hash), time: tx.block.time.toISOString() },
      inputs,
      outputs,
    }
  },
})
export type TransactionsService = ReturnType<typeof createTransactionsService>
