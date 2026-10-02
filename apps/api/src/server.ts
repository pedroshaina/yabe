import { createPrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp } from './app.js'
import { loadApiConfig } from './config.js'

const config = loadApiConfig()
const logger = createLogger({ name: 'api', level: config.LOG_LEVEL })
const prisma = createPrismaClient(config.DATABASE_URL)
const app = await buildApp({
  prisma,
  logger,
  corsOrigins: config.corsOrigins,
  rateLimitMax: config.RATE_LIMIT_MAX,
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, 'shutting down')
    await app.close()
    await prisma.$disconnect()
  })
}

await app.listen({ host: config.API_HOST, port: config.API_PORT })
