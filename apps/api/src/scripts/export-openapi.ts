import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp } from '../app.js'

// Builds the app without touching the database (Prisma connects lazily) and writes the OpenAPI document.
const output = new URL('../../openapi.json', import.meta.url)
const app = await buildApp({
  prisma: createPrismaClient('postgresql://unused@localhost:5432/unused'),
  logger: createLogger({ name: 'openapi', level: 'silent' }),
  corsOrigins: [],
  rateLimitMax: 1,
})
await app.ready()
await writeFile(output, `${JSON.stringify(app.swagger(), null, 2)}\n`)
await app.close()
console.log(`Wrote ${fileURLToPath(output)}`)
