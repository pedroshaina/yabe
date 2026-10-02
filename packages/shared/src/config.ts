import { Type, type Static, type TSchema } from 'typebox'
import { Value } from 'typebox/value'

export class ConfigError extends Error {
  override name = 'ConfigError'
}

export const NetworkSchema = Type.Union([
  Type.Literal('main'),
  Type.Literal('test'),
  Type.Literal('testnet4'),
  Type.Literal('signet'),
  Type.Literal('regtest'),
])

export const LogLevelSchema = Type.Union(
  [
    Type.Literal('fatal'),
    Type.Literal('error'),
    Type.Literal('warn'),
    Type.Literal('info'),
    Type.Literal('debug'),
    Type.Literal('trace'),
    Type.Literal('silent'),
  ],
  { default: 'info' },
)
export type LogLevel = Static<typeof LogLevelSchema>

// Parses environment variables against a TypeBox schema: applies defaults, coerces strings to the declared
// types, drops variables the schema doesn't declare, then validates. Fails with every problem listed at once.
export const loadConfig = <T extends TSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): Static<T> => {
  const value = Value.Clean(schema, Value.Convert(schema, Value.Default(schema, { ...env })))
  if (!Value.Check(schema, value)) {
    const details = [...Value.Errors(schema, value)]
      .map((error) => `  ${error.instancePath || '(root)'} ${error.message}`)
      .join('\n')
    throw new ConfigError(`Invalid configuration:\n${details}`)
  }
  return value
}
