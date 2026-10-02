import type { BitcoinRpcClient } from '@yabe/bitcoin-rpc'
import { toTxNum } from '@yabe/db'
import { startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { bytesToHex, createLogger, hexToBytes } from '@yabe/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BlockStore } from '../src/store/block-store.js'
import { Syncer } from '../src/sync/syncer.js'
import { startRegtestNode } from './bitcoind.js'

let db: TestDatabase
let node: Awaited<ReturnType<typeof startRegtestNode>>
let rpc: BitcoinRpcClient
let syncer: Syncer

const syncToTip = async () => {
  while ((await syncer.syncOnce()) > 0) {
    // keep going until a pass indexes nothing
  }
}

beforeAll(async () => {
  ;[db, node] = await Promise.all([startTestDatabase(), startRegtestNode()])
  rpc = node.rpc
  syncer = new Syncer({
    chain: rpc,
    store: new BlockStore(db.prisma, 'regtest'),
    network: 'regtest',
    logger: createLogger({ name: 'regtest', level: 'silent' }),
    reorgMaxDepth: 10,
    prefetchBlocks: 4,
    pollIntervalMs: 50,
  })
  await rpc.call('createwallet', ['test'])
})

afterAll(async () => {
  await Promise.all([db?.stop(), node?.stop()])
})

describe('indexer against a real Bitcoin Core node (regtest)', () => {
  it('indexes mined blocks and a wallet spend, matching the node', async () => {
    const miner = await rpc.call<string>('getnewaddress')
    await rpc.call('generatetoaddress', [101, miner])
    const destination = await rpc.call<string>('getnewaddress', ['', 'bech32m'])
    const txid = await rpc.call<string>('sendtoaddress', [destination, 1.5])
    await rpc.call('generatetoaddress', [1, miner])

    await syncToTip()

    expect(await db.prisma.block.count()).toBe(103)
    const tx = await db.prisma.transaction.findFirstOrThrow({
      where: { txid: hexToBytes(txid) },
      include: { inputs: true, outputs: true },
    })
    expect(tx.blockHeight).toBe(102)
    expect(tx.feeSats).toBeGreaterThan(0n)
    expect(tx.inputs.length).toBeGreaterThan(0)
    for (const input of tx.inputs) {
      expect(input.prevTxNum).not.toBeNull()
      expect(input.witness).toHaveLength(2) // p2wpkh: signature + pubkey
    }
    expect(
      tx.outputs.some(
        (o) =>
          o.address === destination && o.valueSats === 150_000_000n && o.scriptType === 'witness_v1_taproot',
      ),
    ).toBe(true)

    const stats = await rpc.call<{ totalfee: number; subsidy: number; total_out: number }>('getblockstats', [
      102,
      ['totalfee', 'subsidy', 'total_out'],
    ])
    const block = await db.prisma.block.findUniqueOrThrow({ where: { height: 102 } })
    expect(block.totalFeeSats).toBe(BigInt(stats.totalfee))
    expect(block.subsidySats).toBe(BigInt(stats.subsidy))
    expect(block.totalOutSats).toBe(BigInt(stats.total_out))
    expect(bytesToHex(block.hash)).toBe(await rpc.getBlockHash(102))

    expect(await db.prisma.syncState.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
      network: 'regtest',
      indexedTipHeight: 102,
    })
  })

  it('rolls back and re-indexes after a reorg', async () => {
    const oldTip = await rpc.getBlockCount()
    await rpc.call('invalidateblock', [await rpc.getBlockHash(oldTip - 1)])
    const otherMiner = await rpc.call<string>('getnewaddress')
    await rpc.call('generatetoaddress', [3, otherMiner])
    const newTip = await rpc.getBlockCount()
    expect(newTip).toBe(oldTip + 1)

    await syncToTip()

    expect(await db.prisma.block.count()).toBe(newTip + 1)
    for (let height = oldTip - 3; height <= newTip; height++) {
      const row = await db.prisma.block.findUniqueOrThrow({ where: { height } })
      expect(bytesToHex(row.hash)).toBe(await rpc.getBlockHash(height))
    }
    expect(await db.prisma.transaction.count({ where: { txNum: { gte: toTxNum(newTip + 1, 0) } } })).toBe(0)
    const nodeTxCount = (
      await Promise.all(
        Array.from(
          { length: 4 },
          async (_, i) => (await rpc.getBlock(await rpc.getBlockHash(newTip - i))).nTx,
        ),
      )
    ).reduce((a, b) => a + b, 0)
    expect(await db.prisma.transaction.count({ where: { blockHeight: { gte: newTip - 3 } } })).toBe(
      nodeTxCount,
    )
  })
})
