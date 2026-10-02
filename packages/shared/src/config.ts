import { z } from 'zod'
import { NETWORKS } from './network.js'

export class ConfigError extends Error {
  override name = 'ConfigError'
}

export const NetworkSchema = z.enum(NETWORKS)

export const LogLevelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info')
export type LogLevel = z.infer<typeof LogLevelSchema>

// Parses environment variables against a zod object schema: applies defaults, coerces where the schema says
// so (z.coerce.*), drops variables the schema doesn't declare, then validates. Fails with every problem listed.
export const loadConfig = <T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): z.output<T> => {
  const result = schema.safeParse(env)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new ConfigError(`Invalid configuration:\n${details}`)
  }
  return result.data
}
