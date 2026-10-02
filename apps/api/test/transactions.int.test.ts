import {
  resetDatabase,
  SEED,
  seedChain,
  startTestDatabase,
  type SeededChain,
  type TestDatabase,
} from '@yabe/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { App } from '../src/app.js'
import { createTestApp } from './app.js'

let db: TestDatabase
let app: App
let chain: SeededChain

beforeAll(async () => {
  db = await startTestDatabase()
  app = await createTestApp(db.prisma)
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
  chain = await seedChain(db.prisma)
})
afterAll(async () => {
  await app.close()
  await db.stop()
})

const get = (url: string) => app.inject({ url })

describe('GET /v1/transactions/:txid', () => {
  it('returns a spend with prevouts, scripts, witness and fee', async () => {
    const res = await get(`/v1/transactions/${chain.txids.spend}`)
    expect(res.statusCode).toBe(200)
    const tx = res.json()
    expect(tx).toMatchObject({
      txid: chain.txids.spend,
      isCoinbase: false,
      fee: 10_000,
      feeRate: 70.92,
      totalIn: 5_000_000_000,
      totalOut: 4_999_990_000,
      confirmations: 1,
      vsize: 141,
      version: 2,
      block: { height: 2, hash: chain.blockHashes[2], time: '2026-01-01T00:20:00.000Z' },
    })
    expect(tx.inputs).toEqual([
      {
        vin: 0,
        coinbase: false,
        prevout: {
          txid: chain.txids.coinbase1,
          vout: 0,
          value: 5_000_000_000,
          address: 'bcrt1qminer1',
          scriptType: 'witness_v0_keyhash',
        },
        scriptSig: { hex: '', asm: '' },
        witness: [...SEED.witness],
        sequence: 4_294_967_293,
      },
    ])
    expect(tx.outputs.map((o: { scriptPubKey: { type: string } }) => o.scriptPubKey.type)).toEqual([
      'witness_v1_taproot',
      'witness_v0_keyhash',
      'nulldata',
      'nonstandard',
    ])
    expect(tx.outputs[2].scriptPubKey).toEqual({
      hex: SEED.opReturnScript,
      asm: 'OP_RETURN 68656c6c6f',
      type: 'nulldata',
      address: null,
    })
    expect(tx.outputs[3].scriptPubKey.asm).toBeNull()
    expect(tx.outputs.every((o: { spentBy: unknown }) => o.spentBy === null)).toBe(true)
  })

  it('shows which input spent an output', async () => {
    const tx = (await get(`/v1/transactions/${chain.txids.coinbase1}`)).json()
    expect(tx.isCoinbase).toBe(true)
    expect(tx.fee).toBeNull()
    expect(tx.feeRate).toBeNull()
    expect(tx.totalIn).toBeNull()
    expect(tx.wtxid).toBe(chain.txids.coinbase1)
    expect(tx.inputs[0]).toMatchObject({
      coinbase: true,
      prevout: null,
      scriptSig: { hex: '0101', asm: null },
    })
    expect(tx.outputs[0].spentBy).toEqual({ txid: chain.txids.spend, vin: 0 })
  })

  it('accepts an uppercase txid', async () => {
    expect((await get(`/v1/transactions/${chain.txids.spend.toUpperCase()}`)).statusCode).toBe(200)
  })

  it('returns 404 for an unknown txid and 400 for a malformed one', async () => {
    expect((await get(`/v1/transactions/${'ef'.repeat(32)}`)).statusCode).toBe(404)
    expect((await get('/v1/transactions/not-a-txid')).statusCode).toBe(400)
  })
})
