import { z } from 'zod'
import { DateTime } from '../../schemas/common.js'

export const Status = z.object({
  network: z.string(),
  nodeTipHeight: z.int(),
  indexedTipHeight: z.int(),
  lag: z.int().min(0),
  updatedAt: DateTime,
})
export type Status = z.infer<typeof Status>
