import { ScriptType } from '@yabe/db'
import { Type, type TSchema } from 'typebox'

export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()])

export const HashHex = Type.String({
  pattern: '^[0-9a-f]{64}$',
  description: 'Lowercase hex, display byte order',
})
export const HashParam = Type.String({ pattern: '^[0-9a-fA-F]{64}$' })
// Heights are capped at 9 digits so they always fit a Postgres integer.
export const HashOrHeightParam = Type.String({
  pattern: '^([0-9a-fA-F]{64}|[0-9]{1,9})$',
  description: 'Block hash (64 hex chars) or height',
})
export const Sats = Type.Integer({ minimum: 0, description: 'Amount in satoshis' })
export const DateTime = Type.String({ format: 'date-time' })
export const ScriptTypeSchema = Type.Enum(ScriptType)
export const LimitQuery = Type.Integer({ minimum: 1, maximum: 100, default: 25 })

export const Problem = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer(),
  detail: Type.Optional(Type.String()),
})

export const Page = <T extends TSchema>(item: T) =>
  Type.Object({ data: Type.Array(item), nextCursor: Nullable(Type.Integer()) })
