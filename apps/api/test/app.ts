import type { PrismaClient } from '@yabe/db'
import { createLogger } from '@yabe/shared'
import { buildApp, type App } from '../src/app.js'

export const createTestApp = (prisma: PrismaClient): Promise<App> =>
  buildApp({
    prisma,
    logger: createLogger({ name: 'test', level: 'silent' }),
    corsOrigins: [],
    rateLimitMax: 10_000,
  })
