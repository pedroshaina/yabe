import { expect, it } from 'vitest'
import { loadApiConfig } from './config.js'

it('applies defaults and splits CORS origins', () => {
  expect(
    loadApiConfig({ DATABASE_URL: 'postgresql://x', CORS_ORIGINS: 'http://a.test, http://b.test' }),
  ).toEqual({
    DATABASE_URL: 'postgresql://x',
    API_HOST: '0.0.0.0',
    API_PORT: 8080,
    RATE_LIMIT_MAX: 300,
    LOG_LEVEL: 'info',
    corsOrigins: ['http://a.test', 'http://b.test'],
  })
  expect(loadApiConfig({ DATABASE_URL: 'postgresql://x' }).corsOrigins).toEqual([])
})
