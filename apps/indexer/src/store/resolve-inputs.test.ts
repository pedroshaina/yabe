import { toTxNum } from '@yabe/db'
import { describe, expect, it, vi } from 'vitest'
import { fakeHash, makeBlock, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { transformBlock } from '../transform/block.js'
import { resolveInputs, UnresolvedPrevoutError, type TxNumLookup } from './resolve-inputs.js'

const external = fakeHash('external')
const coinbase = makeCoinbaseTx(5)
const spendExternal = makeSpendTx('a', [{ txid: external, vout: 2, valueBtc: 1 }], [0.9], 0.1)
const spendInBlock = makeSpendTx('b', [{ txid: spendExternal.txid, vout: 0, valueBtc: 0.9 }], [0.8], 0.1)
const data = transformBlock(
  makeBlock({ height: 5, prevHash: fakeHash('p'), txs: [coinbase, spendExternal, spendInBlock] }),
  'regtest',
)

describe('resolveInputs', () => {
  it('resolves coinbase, in-block and external spends with one lookup', async () => {
    const lookup = vi.fn<TxNumLookup>(async () => new Map([[external, toTxNum(3, 4)]]))
    const inputs = await resolveInputs(data, lookup)

    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup.mock.calls[0]![0].map((b) => Buffer.from(b).toString('hex'))).toEqual([external])
    expect(inputs.map((i) => [i.txNum, i.prevTxNum, i.prevVout])).toEqual([
      [toTxNum(5, 0), null, null],
      [toTxNum(5, 1), toTxNum(3, 4), 2],
      [toTxNum(5, 2), toTxNum(5, 1), 0],
    ])
    expect(inputs[0]).not.toHaveProperty('prevTxid')
  })

  it('fails when a previous transaction is not indexed', async () => {
    await expect(resolveInputs(data, async () => new Map())).rejects.toThrow(UnresolvedPrevoutError)
  })
})
