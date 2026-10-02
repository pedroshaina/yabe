import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'
import { ConfigError, LogLevelSchema, loadConfig, NetworkSchema } from './config.js'

const Schema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  PORT: Type.Integer({ minimum: 1, default: 8080 }),
  BITCOIN_NETWORK: NetworkSchema,
  LOG_LEVEL: LogLevelSchema,
})

describe('loadConfig', () => {
  it('coerces numeric strings, applies defaults and drops unknown variables', () => {
    const config = loadConfig(Schema, {
      DATABASE_URL: 'postgresql://x',
      PORT: '9000',
      BITCOIN_NETWORK: 'signet',
      HOME: '/home/me',
    })
    expect(config).toEqual({
      DATABASE_URL: 'postgresql://x',
      PORT: 9000,
      BITCOIN_NETWORK: 'signet',
      LOG_LEVEL: 'info',
    })
  })

  it('reports every problem in one ConfigError', () => {
    const load = () => loadConfig(Schema, { PORT: 'abc', BITCOIN_NETWORK: 'mainnet' })
    expect(load).toThrow(ConfigError)
    expect(load).toThrow(/DATABASE_URL/)
    expect(load).toThrow(/BITCOIN_NETWORK/)
    expect(load).toThrow(/PORT/)
  })
})
