import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase, seedChain, SEED, startTestDatabase, type TestDatabase } from './testing/index.js'
import { toTxNum } from './txnum.js'

let db: TestDatabase

beforeAll(async () => {
  db = await startTestDatabase()
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
  await seedChain(db.prisma)
})
afterAll(async () => {
  await db.stop()
})

describe('schema', () => {
  it('round-trips bytea[] witness data and bigint amounts', async () => {
    const input = await db.prisma.txInput.findUniqueOrThrow({
      where: { txNum_vin: { txNum: toTxNum(2, 1), vin: 0 } },
    })
    expect(input.witness.map((w) => Buffer.from(w).toString('hex'))).toEqual(SEED.witness)
    const output = await db.prisma.txOutput.findUniqueOrThrow({
      where: { txNum_vout: { txNum: toTxNum(2, 1), vout: 0 } },
    })
    expect(output.valueSats).toBe(3_000_000_000n)
  })

  it('rejects a second input spending the same outpoint', async () => {
    await expect(
      db.prisma.txInput.create({
        data: {
          txNum: toTxNum(2, 0),
          vin: 1,
          prevTxNum: toTxNum(1, 0),
          prevVout: 0,
          sequence: 0n,
          scriptSig: new Uint8Array(),
          witness: [],
        },
      }),
    ).rejects.toThrow()
  })

  it('allows many coinbase inputs with NULL prevouts', async () => {
    const count = await db.prisma.txInput.count({ where: { prevTxNum: null } })
    expect(count).toBe(3)
  })

  it('keeps sync_state to a single row', async () => {
    await expect(
      db.prisma.syncState.create({
        data: { id: 2, network: 'regtest', nodeTipHeight: 0, indexedTipHeight: 0, updatedAt: new Date() },
      }),
    ).rejects.toThrow()
  })
})
