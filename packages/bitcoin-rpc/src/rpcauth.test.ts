import { expect, it } from 'vitest'
import { rpcAuthLine } from './rpcauth.js'

it('produces the same line as Bitcoin Core share/rpcauth/rpcauth.py', () => {
  // python3: hmac.new(b'0123456789abcdef0123456789abcdef', b'secret', 'sha256').hexdigest()
  expect(rpcAuthLine('yabe', 'secret', '0123456789abcdef0123456789abcdef')).toBe(
    'yabe:0123456789abcdef0123456789abcdef$0ad814968caefdecab8a6c0c55414688fdcad02f100ee7ac5def2352aaff36e5',
  )
})

it('generates a random 32-hex-character salt by default', () => {
  expect(rpcAuthLine('u', 'p')).toMatch(/^u:[0-9a-f]{32}\$[0-9a-f]{64}$/)
})
