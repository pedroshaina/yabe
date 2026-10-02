import { Type, type Static } from 'typebox'
import { DateTime } from '../../schemas/common.js'

export const Status = Type.Object({
  network: Type.String(),
  nodeTipHeight: Type.Integer(),
  indexedTipHeight: Type.Integer(),
  lag: Type.Integer({ minimum: 0 }),
  updatedAt: DateTime,
})
export type Status = Static<typeof Status>
