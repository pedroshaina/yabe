import { loadConfig, LogLevelSchema, NetworkSchema } from '@yabe/shared'
import { z } from 'zod'

const int = () => z.coerce.number().int()

export const IndexerConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BITCOIN_NETWORK: NetworkSchema,
  BITCOIN_RPC_URL: z.string().min(1),
  BITCOIN_RPC_USER: z.string().min(1),
  BITCOIN_RPC_PASSWORD: z.string().min(1),
  RPC_TIMEOUT_MS: int().min(1).default(30_000),
  POLL_INTERVAL_MS: int().min(100).default(5_000),
  PREFETCH_BLOCKS: int().min(1).max(32).default(4),
  REORG_MAX_DEPTH: int().min(1).default(100),
  LOG_LEVEL: LogLevelSchema,
})
export type IndexerConfig = z.infer<typeof IndexerConfigSchema>

export const loadIndexerConfig = (env: Record<string, string | undefined> = process.env): IndexerConfig =>
  loadConfig(IndexerConfigSchema, env)
