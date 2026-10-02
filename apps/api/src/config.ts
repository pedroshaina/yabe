import { loadConfig, LogLevelSchema } from '@yabe/shared'
import { Type } from 'typebox'

const ApiEnvSchema = Type.Object({
  DATABASE_URL: Type.String({ minLength: 1 }),
  API_HOST: Type.String({ default: '0.0.0.0' }),
  API_PORT: Type.Integer({ minimum: 1, maximum: 65_535, default: 8080 }),
  CORS_ORIGINS: Type.String({ default: '' }),
  RATE_LIMIT_MAX: Type.Integer({ minimum: 1, default: 300 }),
  LOG_LEVEL: LogLevelSchema,
})

export const loadApiConfig = (env: Record<string, string | undefined> = process.env) => {
  const { CORS_ORIGINS, ...rest } = loadConfig(ApiEnvSchema, env)
  return {
    ...rest,
    corsOrigins: CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  }
}
export type ApiConfig = ReturnType<typeof loadApiConfig>
