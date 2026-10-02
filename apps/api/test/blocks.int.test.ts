import {
  resetDatabase,
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

describe('GET /v1/blocks', () => {
  it('lists newest first with summaries', async () => {
    const res = await get('/v1/blocks')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.nextCursor).toBeNull()
    expect(body.data.map((b: { height: number }) => b.height)).toEqual([2, 1, 0])
    expect(body.data[0]).toEqual({
      height: 2,
      hash: chain.blockHashes[2],
      time: '2026-01-01T00:20:00.000Z',
      txCount: 2,
      size: 300,
      weight: 900,
      totalFee: 10_000,
      subsidy: 5_000_000_000,
    })
  })

  it('paginates with a keyset cursor', async () => {
    const first = (await get('/v1/blocks?limit=2')).json()
    expect(first.data.map((b: { height: number }) => b.height)).toEqual([2, 1])
    expect(first.nextCursor).toBe(1)
    const second = (await get(`/v1/blocks?limit=2&before=${first.nextCursor}`)).json()
    expect(second.data.map((b: { height: number }) => b.height)).toEqual([0])
    expect(second.nextCursor).toBeNull()
  })

  it.each(['limit=0', 'limit=101', 'limit=abc', 'before=-1'])(
    'rejects %s with 400 problem+json',
    async (query) => {
      const res = await get(`/v1/blocks?${query}`)
      expect(res.statusCode).toBe(400)
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/)
    },
  )
})

describe('GET /v1/blocks/:hashOrHeight', () => {
  it('returns block detail by height with derived fields', async () => {
    const res = await get('/v1/blocks/1')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      height: 1,
      hash: chain.blockHashes[1],
      prevHash: chain.blockHashes[0],
      nextHash: chain.blockHashes[2],
      confirmations: 2,
      bits: '207fffff',
      nonce: 1,
      version: 0x20000000,
      totalOut: 0,
      chainwork: `${'00'.repeat(31)}02`,
    })
  })

  it('returns block detail by hash, case-insensitively', async () => {
    const res = await get(`/v1/blocks/${chain.blockHashes[2].toUpperCase()}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ height: 2, nextHash: null, confirmations: 1, totalOut: 4_999_990_000 })
  })

  it('returns null prevHash for genesis', async () => {
    expect((await get('/v1/blocks/0')).json().prevHash).toBeNull()
  })

  it('treats a 64-digit all-numeric value as a hash, not a height', async () => {
    const res = await get(`/v1/blocks/${'0'.repeat(64)}`)
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for unknown heights and hashes', async () => {
    expect((await get('/v1/blocks/999999999')).statusCode).toBe(404)
    expect((await get(`/v1/blocks/${'ab'.repeat(32)}`)).json()).toMatchObject({
      status: 404,
      title: 'Not Found',
    })
  })

  it.each(['xyz', '1234567890', 'ab'.repeat(31)])('rejects malformed id %s with 400', async (id) => {
    expect((await get(`/v1/blocks/${id}`)).statusCode).toBe(400)
  })
})

describe('GET /v1/blocks/:hashOrHeight/transactions', () => {
  it('lists transactions in block order with totals', async () => {
    const res = await get(`/v1/blocks/${chain.blockHashes[2]}/transactions`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      data: [
        {
          txid: chain.txids.coinbase2,
          position: 0,
          isCoinbase: true,
          inputCount: 1,
          outputCount: 1,
          totalOut: 5_000_010_000,
          fee: null,
          vsize: 100,
        },
        {
          txid: chain.txids.spend,
          position: 1,
          isCoinbase: false,
          inputCount: 1,
          outputCount: 4,
          totalOut: 4_999_990_000,
          fee: 10_000,
          vsize: 141,
        },
      ],
      nextCursor: null,
    })
  })

  it('paginates by position and accepts a height', async () => {
    const first = (await get('/v1/blocks/2/transactions?limit=1')).json()
    expect(first.data.map((t: { position: number }) => t.position)).toEqual([0])
    expect(first.nextCursor).toBe(0)
    const second = (await get(`/v1/blocks/2/transactions?limit=1&after=${first.nextCursor}`)).json()
    expect(second.data.map((t: { position: number }) => t.position)).toEqual([1])
    expect(second.nextCursor).toBeNull()
  })

  it('returns 404 for an unknown block', async () => {
    expect((await get(`/v1/blocks/${'cd'.repeat(32)}/transactions`)).statusCode).toBe(404)
  })
})
