import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { createPrismaClient } from '../client.js'
import type { PrismaClient } from '../generated/client.js'

const PACKAGE_DIR = fileURLToPath(new URL('../../', import.meta.url))
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js')

export interface TestDatabase {
  url: string
  prisma: PrismaClient
  stop(): Promise<void>
}

// Starts a throwaway Postgres and applies the real migrations to it.
export const startTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start()
  const url = container.getConnectionUri()
  execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  const prisma = createPrismaClient(url)
  return {
    url,
    prisma,
    stop: async () => {
      await prisma.$disconnect()
      await container.stop()
    },
  }
}

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  await prisma.$executeRawUnsafe('TRUNCATE tx_input, tx_output, "transaction", block, sync_state')
}
