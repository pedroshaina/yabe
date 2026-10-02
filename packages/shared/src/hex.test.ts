import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes } from './hex.js'

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = hexToBytes('00ff10ab')
    expect([...bytes]).toEqual([0, 255, 16, 171])
    expect(bytesToHex(bytes)).toBe('00ff10ab')
  })

  it('accepts uppercase input and returns lowercase', () => {
    expect(bytesToHex(hexToBytes('ABCD'))).toBe('abcd')
  })

  it('handles empty input', () => {
    expect(hexToBytes('')).toHaveLength(0)
    expect(bytesToHex(new Uint8Array())).toBe('')
  })

  it('rejects odd-length and non-hex input', () => {
    expect(() => hexToBytes('abc')).toThrow(/Invalid hex/)
    expect(() => hexToBytes('zz')).toThrow(/Invalid hex/)
  })

  it('respects subarray offsets', () => {
    expect(bytesToHex(hexToBytes('00112233').subarray(1, 3))).toBe('1122')
  })
})
