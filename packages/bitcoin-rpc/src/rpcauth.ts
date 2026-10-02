import { createHmac, randomBytes } from 'node:crypto'

// Same algorithm as Bitcoin Core's share/rpcauth/rpcauth.py: HMAC-SHA256 keyed by the hex salt string.
export const rpcAuthLine = (user: string, password: string, salt = randomBytes(16).toString('hex')): string =>
  `${user}:${salt}$${createHmac('sha256', salt).update(password).digest('hex')}`
