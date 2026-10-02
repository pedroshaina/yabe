import { ScriptType } from '@yabe/db'
import { z } from 'zod'

export const HashHex = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .describe('Lowercase hex, display byte order')
export const HashParam = z.string().regex(/^[0-9a-fA-F]{64}$/)
// Heights are capped at 9 digits so they always fit a Postgres integer.
export const HashOrHeightParam = z
  .string()
  .regex(/^([0-9a-fA-F]{64}|[0-9]{1,9})$/)
  .describe('Block hash (64 hex chars) or height')
export const Sats = z.int().min(0).describe('Amount in satoshis')
export const DateTime = z.iso.datetime()
export const ScriptTypeSchema = z.enum(ScriptType)
// Query strings arrive as text, so numeric query params are coerced explicitly.
export const QueryInt = () => z.coerce.number().int()
export const LimitQuery = QueryInt().min(1).max(100).default(25)

export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
})

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), nextCursor: z.int().nullable() })
