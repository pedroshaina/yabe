import { loadConfig, LogLevelSchema } from '@yabe/shared'
import { z } from 'zod'

const ApiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
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
