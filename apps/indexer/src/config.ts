import { loadConfig, LogLevelSchema, NetworkSchema } from '@yabe/shared'
import { Type, type Static } from 'typebox'

export const IndexerConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  BITCOIN_NETWORK: NetworkSchema,
  BITCOIN_RPC_URL: Type.String({ minLength: 1 }),
  BITCOIN_RPC_USER: Type.String({ minLength: 1 }),
  BITCOIN_RPC_PASSWORD: Type.String({ minLength: 1 }),
  RPC_TIMEOUT_MS: Type.Integer({ minimum: 1, default: 30_000 }),
  POLL_INTERVAL_MS: Type.Integer({ minimum: 100, default: 5_000 }),
  PREFETCH_BLOCKS: Type.Integer({ minimum: 1, maximum: 32, default: 4 }),
  REORG_MAX_DEPTH: Type.Integer({ minimum: 1, default: 100 }),
  LOG_LEVEL: LogLevelSchema,
})
export type IndexerConfig = Static<typeof IndexerConfigSchema>

export const loadIndexerConfig = (env: Record<string, string | undefined> = process.env): IndexerConfig =>
  loadConfig(IndexerConfigSchema, env)
