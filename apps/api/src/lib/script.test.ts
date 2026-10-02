import { expect, it } from 'vitest'
import { scriptToAsm } from './script.js'

const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'))

it('decodes standard scripts', () => {
  expect(scriptToAsm(bytes('76a914000102030405060708090a0b0c0d0e0f1011121388ac'))).toBe(
    'OP_DUP OP_HASH160 000102030405060708090a0b0c0d0e0f10111213 OP_EQUALVERIFY OP_CHECKSIG',
  )
  expect(scriptToAsm(bytes('6a0568656c6c6f'))).toBe('OP_RETURN 68656c6c6f')
})

it('returns an empty string for an empty script and null for an undecodable one', () => {
  expect(scriptToAsm(new Uint8Array())).toBe('')
  expect(scriptToAsm(bytes('4c'))).toBeNull()
})
