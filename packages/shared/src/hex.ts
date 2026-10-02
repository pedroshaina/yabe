const HEX_RE = /^(?:[0-9a-fA-F]{2})*$/

export const hexToBytes = (hex: string): Uint8Array<ArrayBuffer> => {
  if (!HEX_RE.test(hex)) {
    throw new Error(`Invalid hex string: "${hex.slice(0, 16)}${hex.length > 16 ? '…' : ''}"`)
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

export const bytesToHex = (bytes: Uint8Array): string =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex')
