import { expect, it } from 'vitest'
import { Backoff } from './backoff.js'

it('doubles up to the cap and resets', () => {
  const backoff = new Backoff({ initialMs: 100, maxMs: 500 })
  expect([backoff.next(), backoff.next(), backoff.next(), backoff.next()]).toEqual([100, 200, 400, 500])
  backoff.reset()
  expect(backoff.next()).toBe(100)
})
