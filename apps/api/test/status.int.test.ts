import { resetDatabase, seedChain, startTestDatabase, type TestDatabase } from '@yabe/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { App } from '../src/app.js'
import { createTestApp } from './app.js'

let db: TestDatabase
let app: App

beforeAll(async () => {
  db = await startTestDatabase()
  app = await createTestApp(db.prisma)
})
beforeEach(async () => {
  await resetDatabase(db.prisma)
})
afterAll(async () => {
  await app.close()
  await db.stop()
})

describe('GET /v1/status', () => {
  it('returns 503 problem+json before the indexer has reported', async () => {
    const res = await app.inject({ url: '/v1/status' })
    expect(res.statusCode).toBe(503)
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(res.json()).toMatchObject({ type: 'about:blank', title: 'Service Unavailable', status: 503 })
  })

  it('reports sync progress', async () => {
    await seedChain(db.prisma)
    const res = await app.inject({ url: '/v1/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      network: 'regtest',
      nodeTipHeight: 3,
      indexedTipHeight: 2,
      lag: 1,
      updatedAt: '2026-01-01T00:30:00.000Z',
    })
    expect(res.headers['cache-control']).toBe('public, max-age=10')
  })
})

describe('cross-cutting behaviour', () => {
  it('returns problem+json for unknown routes', async () => {
    const res = await app.inject({ url: '/v1/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found' })
  })

  it('serves the OpenAPI UI', async () => {
    const res = await app.inject({ url: '/docs/json' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'YABE API' } })
  })

  it('sets security headers', async () => {
    const res = await app.inject({ url: '/v1/status' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})
