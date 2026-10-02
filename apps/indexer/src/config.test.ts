import { ConfigError } from '@yabe/shared'
import { expect, it } from 'vitest'
import { loadIndexerConfig } from './config.js'

const required = {
  DATABASE_URL: 'postgresql://x',
  BITCOIN_NETWORK: 'signet',
  BITCOIN_RPC_URL: 'http://localhost:8332',
  BITCOIN_RPC_USER: 'yabe',
  BITCOIN_RPC_PASSWORD: 'pw',
}

it('applies defaults', () => {
  expect(loadIndexerConfig(required)).toEqual({
    ...required,
    RPC_TIMEOUT_MS: 30_000,
    POLL_INTERVAL_MS: 5_000,
    PREFETCH_BLOCKS: 4,
    REORG_MAX_DEPTH: 100,
    LOG_LEVEL: 'info',
  })
})

it('rejects out-of-range values', () => {
  expect(() => loadIndexerConfig({ ...required, PREFETCH_BLOCKS: '64' })).toThrow(ConfigError)
})
