import { ScriptType } from '@yabe/db'

export class UnknownScriptTypeError extends Error {
  override name = 'UnknownScriptTypeError'
}

const KNOWN = new Set<string>(Object.values(ScriptType))

// Fails instead of guessing: a new output type from a newer Bitcoin Core needs a schema update.
export const toScriptType = (coreType: string): ScriptType => {
  if (!KNOWN.has(coreType)) {
    throw new UnknownScriptTypeError(`Unknown scriptPubKey type '${coreType}'; update the script_type enum`)
  }
  return coreType as ScriptType
}
