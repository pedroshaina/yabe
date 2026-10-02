import { toTxNum } from '@yabe/db'
import { resetDatabase, startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { bytesToHex, hexToBytes } from '@yabe/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fakeHash, makeBlock, makeChain, makeCoinbaseTx, makeSpendTx } from '../../test/fixtures.js'
import { transformBlock } from '../transform/block.js'
import { BlockStore } from './block-store.js'
import { UnresolvedPrevoutError } from './resolve-inputs.js'

let db: TestDatabase
let store: BlockStore

beforeAll(async () => {
  db = await startTestDatabase()
  store = new BlockStore(db.prisma, 'regtest')
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
})
afterAll(async () => {
  await db.stop()
})

const writeChain = async (length: number) => {
  const chain = makeChain(length)
  for (const block of chain) await store.writeBlock(transformBlock(block, 'regtest'), length - 1)
  return chain
}

describe('BlockStore', () => {
  it('starts empty', async () => {
    expect(await store.getTip()).toBeNull()
  })

  it('writes blocks atomically and tracks the tip and sync state', async () => {
    const chain = await writeChain(3)
    expect(await store.getTip()).toEqual({ height: 2, hash: chain[2]!.hash })
    expect(await store.getHashAt(1)).toBe(chain[1]!.hash)
    expect(await store.getHashAt(9)).toBeNull()
    expect(await db.prisma.syncState.findUnique({ where: { id: 1 } })).toMatchObject({
      network: 'regtest',
      nodeTipHeight: 2,
      indexedTipHeight: 2,
    })
  })

  it('links inputs to previous outputs across blocks', async () => {
    const chain = await writeChain(2)
    const funding = chain[1]!.tx[0]!
    const spend = makeSpendTx('spend', [{ txid: funding.txid, vout: 0, valueBtc: 50 }], [49.9], 0.1)
    await store.writeBlock(
      transformBlock(
        makeBlock({ height: 2, prevHash: chain[1]!.hash, txs: [makeCoinbaseTx(2), spend] }),
        'regtest',
      ),
      2,
    )
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input).toMatchObject({ prevTxNum: toTxNum(1, 0), prevVout: 0 })
  })

  it('writes nothing when a prevout cannot be resolved', async () => {
    const chain = await writeChain(1)
    const orphanSpend = makeSpendTx('o', [{ txid: fakeHash('missing'), vout: 0, valueBtc: 1 }], [0.9], 0.1)
    const block = makeBlock({ height: 1, prevHash: chain[0]!.hash, txs: [makeCoinbaseTx(1), orphanSpend] })
    await expect(store.writeBlock(transformBlock(block, 'regtest'), 1)).rejects.toThrow(
      UnresolvedPrevoutError,
    )
    expect(await db.prisma.block.count()).toBe(1)
    expect(await db.prisma.transaction.count()).toBe(1)
  })

  it('resolves duplicate (BIP30) txids to the newest transaction', async () => {
    const chain = makeChain(2)
    // Block 1's coinbase reuses block 0's coinbase txid, as happened on mainnet at heights 91842/91880.
    chain[1]!.tx[0] = makeCoinbaseTx(1, { seed: 'main-cb-0' })
    for (const block of chain) await store.writeBlock(transformBlock(block, 'regtest'), 2)
    const dupTxid = chain[0]!.tx[0]!.txid
    const spend = makeSpendTx('s', [{ txid: dupTxid, vout: 0, valueBtc: 50 }], [49], 1)
    await store.writeBlock(
      transformBlock(
        makeBlock({ height: 2, prevHash: chain[1]!.hash, txs: [makeCoinbaseTx(2), spend] }),
        'regtest',
      ),
      2,
    )
    expect(await db.prisma.transaction.count({ where: { txid: hexToBytes(dupTxid) } })).toBe(2)
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input.prevTxNum).toBe(toTxNum(1, 0))
  })

  it('writes a block with more inputs and outputs than one statement can bind', async () => {
    const chain = await writeChain(1)
    const coinbase = makeCoinbaseTx(1)
    coinbase.vout = Array.from({ length: 12_000 }, (_, n) => ({
      value: 0.0001,
      n,
      scriptPubKey: { asm: '', hex: `0014${fakeHash(`o${n}`).slice(0, 40)}`, type: 'witness_v0_keyhash' },
    }))
    const spends = Array.from({ length: 6_000 }, (_, n) => ({
      txid: coinbase.txid,
      vout: n,
      valueBtc: 0.0001,
    }))
    const bigSpend = makeSpendTx('big', spends, [0.5], 0.1)
    const block = makeBlock({ height: 1, prevHash: chain[0]!.hash, txs: [coinbase, bigSpend] })

    await store.writeBlock(transformBlock(block, 'regtest'), 1)
    expect(await db.prisma.txOutput.count({ where: { txNum: toTxNum(1, 0) } })).toBe(12_000)
    expect(await db.prisma.txInput.count({ where: { txNum: toTxNum(1, 1) } })).toBe(6_000)
  })

  it('rolls back every row at or above a height', async () => {
    await writeChain(4)
    await store.rollbackFrom(2)
    expect((await store.getTip())?.height).toBe(1)
    expect(await db.prisma.transaction.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect(await db.prisma.txOutput.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect(await db.prisma.txInput.count({ where: { txNum: { gte: toTxNum(2, 0) } } })).toBe(0)
    expect((await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).indexedTipHeight).toBe(1)
  })

  it('records the node tip without changing the indexed tip', async () => {
    await writeChain(2)
    await store.recordNodeTip(10)
    expect(await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      nodeTipHeight: 10,
      indexedTipHeight: 1,
    })
  })

  it('stores hashes in display order', async () => {
    const chain = await writeChain(1)
    const row = await db.prisma.block.findUniqueOrThrow({ where: { height: 0 } })
    expect(bytesToHex(row.hash)).toBe(chain[0]!.hash)
  })
})
