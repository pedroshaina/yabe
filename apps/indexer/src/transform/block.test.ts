import { bytesToHex } from '@yabe/shared'
import { toTxNum } from '@yabe/db'
import { describe, expect, it } from 'vitest'
import { fakeHash, makeBlock, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { InvalidBlockError, MissingFeeError, transformBlock } from './block.js'
import { toScriptType, UnknownScriptTypeError } from './script-type.js'

describe('transformBlock', () => {
  it('maps a genesis-style block with only a coinbase', () => {
    const data = transformBlock(
      makeBlock({ height: 0, prevHash: undefined, txs: [makeCoinbaseTx(0)] }),
      'regtest',
    )

    expect(data.block).toMatchObject({
      height: 0,
      prevHash: null,
      bits: 0x207fffffn,
      nonce: 42n,
      txCount: 1,
      subsidySats: 5_000_000_000n,
      totalFeeSats: 0n,
      totalOutSats: 0n,
      time: new Date(1_767_225_600 * 1000),
    })
    expect(data.transactions).toHaveLength(1)
    expect(data.transactions[0]).toMatchObject({ txNum: 0n, isCoinbase: true, feeSats: null, wtxid: null })
    expect(data.inputs[0]).toMatchObject({ prevTxid: null, prevVout: null, sequence: 4_294_967_295n })
    expect(bytesToHex(data.inputs[0]!.scriptSig)).toBe('03000000')
    expect(data.outputs[0]).toMatchObject({ valueSats: 5_000_000_000n, scriptType: 'witness_v0_keyhash' })
  })

  it('maps spends, fees, totals and tx_num positions', () => {
    const funding = fakeHash('funding')
    const spend = makeSpendTx('spend', [{ txid: funding, vout: 1, valueBtc: 2 }], [1.5, 0.4999], 0.0001)
    const coinbase = makeCoinbaseTx(7, { valueBtc: 50.0001 })
    const data = transformBlock(
      makeBlock({ height: 7, prevHash: fakeHash('prev'), txs: [coinbase, spend] }),
      'main',
    )

    expect(data.transactions.map((t) => t.txNum)).toEqual([toTxNum(7, 0), toTxNum(7, 1)])
    expect(data.transactions[1]).toMatchObject({
      isCoinbase: false,
      feeSats: 10_000n,
      inputCount: 1,
      outputCount: 2,
      version: 2n,
    })
    expect(bytesToHex(data.transactions[1]!.wtxid!)).toBe(fakeHash('spend-witness'))
    expect(data.block.totalFeeSats).toBe(10_000n)
    expect(data.block.totalOutSats).toBe(199_990_000n)
    expect(bytesToHex(data.block.prevHash!)).toBe(fakeHash('prev'))

    const input = data.inputs.find((i) => i.txNum === toTxNum(7, 1))!
    expect(input).toMatchObject({ vin: 0, prevTxid: funding, prevVout: 1, sequence: 4_294_967_293n })
    expect(input.witness.map(bytesToHex)).toEqual(['3044aa', '02bb'])
    expect(input.scriptSig).toHaveLength(0)
  })

  it('stores a null address when the node reports none', () => {
    const coinbase = makeCoinbaseTx(1)
    coinbase.vout.push({ value: 0, n: 1, scriptPubKey: { asm: 'OP_RETURN', hex: '6a', type: 'nulldata' } })
    const data = transformBlock(makeBlock({ height: 1, prevHash: fakeHash('p'), txs: [coinbase] }), 'main')
    expect(data.outputs[1]).toMatchObject({ address: null, scriptType: 'nulldata', valueSats: 0n })
  })

  it('fails when a non-coinbase transaction has no fee (pruned node without undo data)', () => {
    const spend = makeSpendTx('s', [{ txid: fakeHash('f'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    delete spend.fee
    const block = makeBlock({ height: 3, prevHash: fakeHash('p'), txs: [makeCoinbaseTx(3), spend] })
    expect(() => transformBlock(block, 'main')).toThrow(MissingFeeError)
  })

  it('fails when the coinbase is not the first transaction', () => {
    const spend = makeSpendTx('s', [{ txid: fakeHash('f'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    const block = makeBlock({ height: 3, prevHash: fakeHash('p'), txs: [spend, makeCoinbaseTx(3)] })
    expect(() => transformBlock(block, 'main')).toThrow(InvalidBlockError)
  })
})

describe('toScriptType', () => {
  it('accepts every Bitcoin Core output type', () => {
    for (const type of [
      'nonstandard',
      'pubkey',
      'pubkeyhash',
      'scripthash',
      'multisig',
      'nulldata',
      'anchor',
      'witness_v0_keyhash',
      'witness_v0_scripthash',
      'witness_v1_taproot',
      'witness_unknown',
    ]) {
      expect(toScriptType(type)).toBe(type)
    }
  })

  it('fails loudly on a type this version does not know', () => {
    expect(() => toScriptType('witness_v2_future')).toThrow(UnknownScriptTypeError)
  })
})
