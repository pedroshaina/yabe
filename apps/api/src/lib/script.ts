import { script } from 'bitcoinjs-lib'

// ASM for display. Returns null when the bytes don't parse as a script, which is legal on-chain in output scripts.
// Note: bitcoinjs-lib's ASM differs cosmetically from Bitcoin Core's (e.g. small integers, sighash suffixes).
export const scriptToAsm = (bytes: Uint8Array): string | null => {
  try {
    return script.toASM(bytes)
  } catch {
    return null
  }
}
