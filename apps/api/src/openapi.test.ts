import { readFile } from 'node:fs/promises'
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { expect, it } from 'vitest'
import { buildApp } from './app.js'

it('matches the committed openapi.json (run `pnpm --filter @yabe/api openapi:export` after API changes)', async () => {
  const app = await buildApp({
    prisma: createPrismaClient('postgresql://unused@localhost:5432/unused'),
    logger: createLogger({ name: 'test', level: 'silent' }),
    corsOrigins: [],
    rateLimitMax: 1,
  })
  await app.ready()
  const spec = JSON.parse(JSON.stringify(app.swagger())) as { paths: Record<string, unknown> }
  await app.close()

  expect(Object.keys(spec.paths).sort()).toEqual([
    '/v1/blocks',
    '/v1/blocks/{hashOrHeight}',
    '/v1/blocks/{hashOrHeight}/transactions',
    '/v1/status',
    '/v1/transactions/{txid}',
  ])
  const committed = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'))
  expect(spec).toEqual(committed)
})
